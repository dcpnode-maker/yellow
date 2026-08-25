import { SQL, type ReservedSQL } from "bun";

const AUTHORITY_LOCK = 6_441_674_055_002_974_569n;
const MIN_PASSWORD_LENGTH = 32;
const MAX_PASSWORD_LENGTH = 256;

interface RoleRow {
  readonly rolname: string;
  readonly rolcanlogin: boolean;
  readonly rolconnlimit: number;
  readonly rolpassword: string | null;
  readonly rolsuper: boolean;
  readonly rolcreatedb: boolean;
  readonly rolcreaterole: boolean;
  readonly rolinherit: boolean;
  readonly rolreplication: boolean;
  readonly rolbypassrls: boolean;
}

interface SessionRow {
  readonly session_user: string;
  readonly current_user: string;
  readonly database_owner: string;
  readonly is_superuser: boolean;
}

export interface ProvisionLocalDatabaseAuthorityOptions {
  readonly deployDatabaseUrl: string;
  readonly runtimePassword: string;
  readonly logger?: (line: string) => void;
}

export interface ProvisionLocalDatabaseAuthorityResult {
  readonly owner: "created" | "already exact";
  readonly runtime: "created" | "already exact";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function replaceEvery(value: string, target: string, replacement: string): string {
  return target === "" ? value : value.split(target).join(replacement);
}

function redactedError(error: unknown, databaseUrl: string, runtimePassword: string): Error {
  let value = replaceEvery(errorMessage(error), databaseUrl, "[REDACTED_DATABASE_URL]");
  value = replaceEvery(value, runtimePassword, "[REDACTED]");
  try {
    const parsed = new URL(databaseUrl);
    for (const credential of [
      parsed.username,
      parsed.password,
      decodeURIComponent(parsed.username),
      decodeURIComponent(parsed.password),
    ]) {
      if (credential !== "") value = replaceEvery(value, credential, "[REDACTED]");
    }
  } catch {
    // The input validator reports malformed URLs without reflecting their contents.
  }
  value = value.replace(/(postgres(?:ql)?:\/\/)[^@\s]+@/gi, "$1[REDACTED]@");
  return new Error(value, { cause: error });
}

function deployUrl(value: string): URL {
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error("YELLOW_DEPLOY_DATABASE_URL must be a valid PostgreSQL URL");
  }
  if (!/^postgres(?:ql)?:$/.test(parsed.protocol)) {
    throw new Error("YELLOW_DEPLOY_DATABASE_URL must use the PostgreSQL protocol");
  }
  if (decodeURIComponent(parsed.username) !== "yellow_deploy" || parsed.password === "") {
    throw new Error("YELLOW_DEPLOY_DATABASE_URL must authenticate the exact yellow_deploy role");
  }
  if (parsed.hash !== "") throw new Error("YELLOW_DEPLOY_DATABASE_URL must not contain a fragment");
  return parsed;
}

function checkedPassword(value: string): string {
  if (value.length < MIN_PASSWORD_LENGTH || value.length > MAX_PASSWORD_LENGTH) {
    throw new Error(
      `YELLOW_RUNTIME_DATABASE_PASSWORD must contain ${MIN_PASSWORD_LENGTH} to ${MAX_PASSWORD_LENGTH} characters`,
    );
  }
  if (/\p{Cc}/u.test(value)) {
    throw new Error("YELLOW_RUNTIME_DATABASE_PASSWORD must not contain control characters");
  }
  return value;
}

function quoteLiteral(value: string): string {
  return `'${value.replaceAll("'", "''")}'`;
}

function exactOwner(role: RoleRow | undefined): boolean {
  return role !== undefined
    && role.rolname === "yellow_owner"
    && role.rolcanlogin === false
    && role.rolconnlimit === 0
    && role.rolpassword === null
    && role.rolsuper === false
    && role.rolcreatedb === false
    && role.rolcreaterole === false
    && role.rolinherit === false
    && role.rolreplication === false
    && role.rolbypassrls === false;
}

function exactRuntime(role: RoleRow | undefined): boolean {
  return role !== undefined
    && role.rolname === "yellow_runtime"
    && role.rolcanlogin === true
    && role.rolconnlimit === -1
    && role.rolpassword !== null
    && role.rolsuper === false
    && role.rolcreatedb === false
    && role.rolcreaterole === false
    && role.rolinherit === false
    && role.rolreplication === false
    && role.rolbypassrls === false;
}

async function sessionContract(connection: ReservedSQL): Promise<void> {
  const rows = await connection<SessionRow[]>`
    SELECT session_user,
           current_user,
           pg_get_userbyid(d.datdba) AS database_owner,
           r.rolsuper AS is_superuser
      FROM pg_database d
      JOIN pg_roles r ON r.rolname = session_user
     WHERE d.datname = current_database()
  `;
  const row = rows[0];
  if (rows.length !== 1 || !row || row.session_user !== "yellow_deploy"
      || row.current_user !== "yellow_deploy" || row.database_owner !== "yellow_deploy"
      || row.is_superuser !== true) {
    throw new Error("local authority provisioning requires the yellow_deploy database-owning superuser");
  }
}

async function roles(connection: ReservedSQL): Promise<readonly RoleRow[]> {
  return await connection<RoleRow[]>`
    SELECT rolname,
           rolcanlogin,
           rolconnlimit,
           rolpassword,
           rolsuper,
           rolcreatedb,
           rolcreaterole,
           rolinherit,
           rolreplication,
           rolbypassrls
      FROM pg_authid
     WHERE rolname IN ('yellow_owner', 'yellow_runtime')
     ORDER BY rolname
  `;
}

async function verifyMembership(connection: ReservedSQL): Promise<void> {
  const rows = await connection<Array<{
    granted_role: string;
    member_role: string;
    admin_option: boolean;
    inherit_option: boolean;
    set_option: boolean;
  }>>`
    SELECT granted.rolname AS granted_role,
           member.rolname AS member_role,
           membership.admin_option,
           membership.inherit_option,
           membership.set_option
      FROM pg_auth_members membership
      JOIN pg_roles granted ON granted.oid = membership.roleid
      JOIN pg_roles member ON member.oid = membership.member
     WHERE granted.rolname IN ('yellow_owner', 'yellow_runtime', 'app_role')
        OR member.rolname IN ('yellow_owner', 'yellow_runtime', 'app_role')
     ORDER BY granted.rolname, member.rolname
  `;
  if (rows.some(({ granted_role, member_role, admin_option, inherit_option, set_option }) => (
    granted_role !== "app_role" || member_role !== "yellow_runtime"
    || admin_option || inherit_option || !set_option
  ))) {
    throw new Error("local authority roles contain an unsupported membership edge");
  }
}

async function verifyRuntimeLogin(url: URL): Promise<void> {
  const runtimePool = new SQL(url.toString(), { max: 1 });
  try {
    const rows = await runtimePool<Array<{ session_user: string; current_user: string }>>`
      SELECT session_user, current_user
    `;
    if (rows.length !== 1 || rows[0]?.session_user !== "yellow_runtime"
        || rows[0]?.current_user !== "yellow_runtime") {
      throw new Error("the generated runtime credential did not authenticate as yellow_runtime");
    }
  } finally {
    await runtimePool.close();
  }
}

export async function provisionLocalDatabaseAuthority(
  options: ProvisionLocalDatabaseAuthorityOptions,
): Promise<ProvisionLocalDatabaseAuthorityResult> {
  const parsedDeployUrl = deployUrl(options.deployDatabaseUrl);
  const runtimePassword = checkedPassword(options.runtimePassword);
  const logger = options.logger ?? console.log;
  const pool = new SQL(parsedDeployUrl.toString(), { max: 1 });
  const connection = await pool.reserve();
  let began = false;

  try {
    await sessionContract(connection);
    await connection.unsafe("BEGIN");
    began = true;
    await connection`SELECT pg_advisory_xact_lock(${AUTHORITY_LOCK})`;
    await connection.unsafe("SET LOCAL password_encryption = 'scram-sha-256'");

    const initial = await roles(connection);
    const initialOwner = initial.find(({ rolname }) => rolname === "yellow_owner");
    const initialRuntime = initial.find(({ rolname }) => rolname === "yellow_runtime");
    if (initialOwner && !exactOwner(initialOwner)) throw new Error("yellow_owner has incompatible existing attributes");
    if (initialRuntime && !exactRuntime(initialRuntime)) {
      throw new Error("yellow_runtime has incompatible existing attributes");
    }
    await verifyMembership(connection);

    if (initialRuntime) {
      const existingRuntimeUrl = new URL(parsedDeployUrl);
      existingRuntimeUrl.username = "yellow_runtime";
      existingRuntimeUrl.password = runtimePassword;
      await verifyRuntimeLogin(existingRuntimeUrl);
    }

    if (!initialOwner) {
      await connection.unsafe(`CREATE ROLE yellow_owner WITH
        NOLOGIN PASSWORD NULL CONNECTION LIMIT 0 NOSUPERUSER NOCREATEDB
        NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    }
    if (!initialRuntime) {
      await connection.unsafe(`CREATE ROLE yellow_runtime WITH
        LOGIN PASSWORD ${quoteLiteral(runtimePassword)} CONNECTION LIMIT -1
        NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOREPLICATION NOBYPASSRLS`);
    }

    const final = await roles(connection);
    if (!exactOwner(final.find(({ rolname }) => rolname === "yellow_owner"))
        || !exactRuntime(final.find(({ rolname }) => rolname === "yellow_runtime"))) {
      throw new Error("database authority roles did not reach the exact required catalogue");
    }
    await connection.unsafe("COMMIT");
    began = false;

    const runtimeUrl = new URL(parsedDeployUrl);
    runtimeUrl.username = "yellow_runtime";
    runtimeUrl.password = runtimePassword;
    await verifyRuntimeLogin(runtimeUrl);

    const result: ProvisionLocalDatabaseAuthorityResult = Object.freeze({
      owner: initialOwner ? "already exact" : "created",
      runtime: initialRuntime ? "already exact" : "created",
    });
    logger(`database authority provisioned: owner=${result.owner} runtime=${result.runtime}`);
    return result;
  } catch (error) {
    if (began) {
      try { await connection.unsafe("ROLLBACK"); } catch { /* Preserve the original failure. */ }
    }
    throw redactedError(error, parsedDeployUrl.toString(), runtimePassword);
  } finally {
    connection.release();
    await pool.close();
  }
}

async function runCli(): Promise<void> {
  const deployDatabaseUrl = process.env.YELLOW_DEPLOY_DATABASE_URL;
  const runtimePassword = process.env.YELLOW_RUNTIME_DATABASE_PASSWORD;
  if (!deployDatabaseUrl || !runtimePassword) {
    console.error("YELLOW_DEPLOY_DATABASE_URL and YELLOW_RUNTIME_DATABASE_PASSWORD are required");
    process.exitCode = 1;
    return;
  }
  try {
    await provisionLocalDatabaseAuthority({ deployDatabaseUrl, runtimePassword });
  } catch (error) {
    console.error(`database authority provisioning failed: ${errorMessage(error)}`);
    process.exitCode = 1;
  }
}

if (import.meta.main) await runCli();

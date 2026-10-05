import { app } from "./app";

const port = Bun.env.PORT === undefined ? 3000 : Number(Bun.env.PORT);

app.listen(port);

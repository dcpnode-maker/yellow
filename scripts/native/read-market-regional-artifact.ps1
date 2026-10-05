# Order472: read-only, single-artifact transport. The caller owns the deadline,
# output bound, trusted manifest and SHA256/UTF8 admission; this child owns handles.
# Parse arguments ourselves so malformed input receives the same static receipt.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$WarningPreference = 'SilentlyContinue'
$InformationPreference = 'SilentlyContinue'
$VerbosePreference = 'SilentlyContinue'
$DebugPreference = 'SilentlyContinue'
Set-StrictMode -Version Latest

try {
    if ($PSVersionTable.PSVersion.Major -lt 7 -or
        -not [Runtime.InteropServices.RuntimeInformation]::IsOSPlatform([Runtime.InteropServices.OSPlatform]::Windows)) {
        throw 'unsupported'
    }
    if ($args.Count -ne 6) { throw 'invalid' }
    $options = @{}
    for ($index = 0; $index -lt $args.Count; $index += 2) {
        $name = [string] $args[$index]
        if ($name -cnotin @('-RootDirectory', '-RelativePath', '-ExpectedLength') -or $options.ContainsKey($name)) {
            throw 'invalid'
        }
        $options[$name] = [string] $args[$index + 1]
    }
    if ($options.Count -ne 3 -or $options['-ExpectedLength'] -cnotmatch '^[1-9][0-9]{0,6}$') { throw 'invalid' }
    $expectedLength = [int]::Parse($options['-ExpectedLength'], [Globalization.CultureInfo]::InvariantCulture)
    if ($expectedLength -gt 4194304) { throw 'invalid' }

    # SafeFileHandle marshals HANDLE natively. No numeric/pointer reinterpretation.
    # https://learn.microsoft.com/windows/win32/api/fileapi/nf-fileapi-createfilew
    # https://learn.microsoft.com/windows/win32/api/fileapi/ns-fileapi-by_handle_file_information
    # https://learn.microsoft.com/windows/win32/api/fileapi/nf-fileapi-getfinalpathnamebyhandlew
    # https://learn.microsoft.com/windows/win32/api/fileapi/nf-fileapi-readfile
    Add-Type -Language CSharp -ErrorAction Stop -TypeDefinition @'
using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;
using System.Text.RegularExpressions;
using Microsoft.Win32.SafeHandles;

namespace Yellow.MarketRegionalReadV1 {
    public static class NativeReader {
        private const int MaximumBytes = 4 * 1024 * 1024;
        private const int MaximumPathCharacters = 4096;
        private const uint ReadAttributes = 0x80;
        private const uint GenericRead = 0x80000000;
        private const uint ShareRead = 1;
        private const uint OpenExisting = 3;
        private const uint OpenReparsePoint = 0x00200000;
        private const uint BackupSemantics = 0x02000000;
        private const uint DirectoryAttribute = 0x10;
        private const uint ReparseAttribute = 0x400;
        private const uint DiskFileType = 1;
        private const string ExtendedPrefix = "\\\\?\\";
        private static readonly Regex ReservedName = new Regex(
            @"^(CON|PRN|AUX|NUL|CLOCK\$|CONIN\$|CONOUT\$|COM[0-9\u00b9\u00b2\u00b3]|LPT[0-9\u00b9\u00b2\u00b3])(?:\.|$)",
            RegexOptions.IgnoreCase | RegexOptions.CultureInvariant);

        [StructLayout(LayoutKind.Sequential)]
        private struct FileTime {
            public uint Low;
            public uint High;
        }

        [StructLayout(LayoutKind.Sequential)]
        private struct FileInformation {
            public uint Attributes;
            public FileTime Creation;
            public FileTime LastAccess;
            public FileTime LastWrite;
            public uint Volume;
            public uint SizeHigh;
            public uint SizeLow;
            public uint Links;
            public uint IndexHigh;
            public uint IndexLow;
        }

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
        private static extern SafeFileHandle CreateFileW(string path, uint access, uint sharing,
            IntPtr security, uint disposition, uint flags, IntPtr template);

        [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool GetFileInformationByHandle(SafeFileHandle handle, out FileInformation information);

        [DllImport("kernel32.dll", CharSet = CharSet.Unicode, ExactSpelling = true, SetLastError = true)]
        private static extern uint GetFinalPathNameByHandleW(SafeFileHandle handle, StringBuilder path,
            uint capacity, uint flags);

        [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)]
        private static extern uint GetFileType(SafeFileHandle handle);

        [DllImport("kernel32.dll", ExactSpelling = true, SetLastError = true)]
        [return: MarshalAs(UnmanagedType.Bool)]
        private static extern bool ReadFile(SafeFileHandle handle, [Out] byte[] buffer,
            uint requested, out uint read, IntPtr overlapped);

        private sealed class HeldDirectory {
            public SafeFileHandle Handle;
            public string Path;
            public FileInformation Before;
            public HeldDirectory(SafeFileHandle handle, string path, FileInformation before) {
                Handle = handle; Path = path; Before = before;
            }
        }

        private static void Require(bool condition) {
            if (!condition) throw new InvalidDataException("invalid_regional_snapshot");
        }

        private static string Separators(string value) {
            Require(value != null && value.Length > 0 && value.Length <= MaximumPathCharacters);
            foreach (char character in value) Require(!Char.IsControl(character));
            return value.Replace('/', '\\');
        }

        private static void ValidateComponent(string component) {
            Require(component.Length > 0 && component.Length <= 255 && component != "." && component != "..");
            Require(!component.EndsWith(".", StringComparison.Ordinal) && !component.EndsWith(" ", StringComparison.Ordinal));
            Require(component.IndexOfAny(new char[] { '<', '>', '"', '|', '?', '*', ':' }) < 0);
            Require(!ReservedName.IsMatch(component));
        }

        private static string RootPath(string value) {
            string path = Separators(value);
            Require(path.Length >= 3 && ((path[0] >= 'A' && path[0] <= 'Z') ||
                (path[0] >= 'a' && path[0] <= 'z')) && path[1] == ':' && path[2] == '\\');
            if (path.Length > 3 && path.EndsWith("\\", StringComparison.Ordinal)) path = path.Substring(0, path.Length - 1);
            if (path.Length > 3) foreach (string component in path.Substring(3).Split('\\')) ValidateComponent(component);
            string full = System.IO.Path.GetFullPath(path);
            Require(String.Equals(full, path, StringComparison.OrdinalIgnoreCase));
            return full;
        }

        private static string LeafPath(string root, string value) {
            string relative = Separators(value);
            Require(!System.IO.Path.IsPathRooted(relative));
            foreach (string component in relative.Split('\\')) ValidateComponent(component);
            string joined = System.IO.Path.Combine(root, relative);
            Require(joined.Length <= MaximumPathCharacters);
            string full = System.IO.Path.GetFullPath(joined);
            string prefix = root.EndsWith("\\", StringComparison.Ordinal) ? root : root + "\\";
            Require(String.Equals(full, joined, StringComparison.OrdinalIgnoreCase) &&
                full.StartsWith(prefix, StringComparison.OrdinalIgnoreCase));
            return full;
        }

        private static SafeFileHandle Open(string path, bool directory, List<SafeFileHandle> owned) {
            // OPEN_EXISTING only; all handles deny write/delete sharing and inheritance.
            SafeFileHandle handle = CreateFileW(ExtendedPrefix + path, directory ? ReadAttributes : GenericRead,
                ShareRead, IntPtr.Zero, OpenExisting, OpenReparsePoint | BackupSemantics, IntPtr.Zero);
            if (handle == null || handle.IsInvalid) {
                if (handle != null) handle.Dispose();
                throw new InvalidDataException("invalid_regional_snapshot");
            }
            owned.Add(handle); // Own it before any subsequent operation can fail.
            return handle;
        }

        private static FileInformation Information(SafeFileHandle handle, bool directory) {
            FileInformation information;
            Require(GetFileType(handle) == DiskFileType);
            Require(GetFileInformationByHandle(handle, out information));
            Require((information.Attributes & ReparseAttribute) == 0 &&
                ((information.Attributes & DirectoryAttribute) != 0) == directory);
            if (!directory) Require(information.Links == 1);
            return information;
        }

        private static void FinalPath(SafeFileHandle handle, string expected) {
            StringBuilder actual = new StringBuilder(MaximumPathCharacters + ExtendedPrefix.Length + 1);
            uint length = GetFinalPathNameByHandleW(handle, actual, (uint)actual.Capacity, 0);
            Require(length > 0 && length < actual.Capacity && actual.Length == length);
            string result = actual.ToString();
            Require(result.StartsWith(ExtendedPrefix, StringComparison.Ordinal) &&
                String.Equals(result.Substring(ExtendedPrefix.Length), expected, StringComparison.OrdinalIgnoreCase));
        }

        private static bool SameIdentity(FileInformation before, FileInformation after) {
            return before.Volume == after.Volume && before.IndexHigh == after.IndexHigh &&
                before.IndexLow == after.IndexLow && before.Attributes == after.Attributes;
        }

        private static bool SameTime(FileTime before, FileTime after) {
            return before.Low == after.Low && before.High == after.High;
        }

        private static void ExactSize(FileInformation information, int expected) {
            Require(information.SizeHigh == 0 && information.SizeLow == (uint)expected);
        }

        public static byte[] Read(string rootDirectory, string relativePath, int expectedLength) {
            Require(expectedLength >= 1 && expectedLength <= MaximumBytes);
            string root = RootPath(rootDirectory);
            string leaf = LeafPath(root, relativePath);
            List<SafeFileHandle> owned = new List<SafeFileHandle>();
            List<HeldDirectory> directories = new List<HeldDirectory>();
            try {
                string current = System.IO.Path.GetPathRoot(leaf);
                string[] components = leaf.Substring(current.Length).Split('\\');
                // Hold the drive root and each following ancestor, not merely a
                // pathname preflight that could be swapped before the leaf opens.
                for (int index = 0; index < components.Length; index++) {
                    SafeFileHandle directory = Open(current, true, owned);
                    FileInformation information = Information(directory, true);
                    FinalPath(directory, current);
                    if (directories.Count > 0) Require(information.Volume == directories[0].Before.Volume);
                    directories.Add(new HeldDirectory(directory, current, information));
                    if (index < components.Length - 1) current = System.IO.Path.Combine(current, components[index]);
                }
                SafeFileHandle file = Open(leaf, false, owned);
                FileInformation before = Information(file, false);
                Require(before.Volume == directories[0].Before.Volume);
                ExactSize(before, expectedLength);
                FinalPath(file, leaf);

                byte[] result = new byte[expectedLength];
                byte[] buffer = new byte[Math.Min(65536, expectedLength + 1)];
                int offset = 0;
                while (true) {
                    uint requested = (uint)Math.Min(buffer.Length, expectedLength - offset + 1);
                    uint count;
                    Require(ReadFile(file, buffer, requested, out count, IntPtr.Zero));
                    Require(count <= requested && count <= expectedLength - offset);
                    if (count == 0) break;
                    Buffer.BlockCopy(buffer, 0, result, offset, (int)count);
                    offset += (int)count;
                }
                Require(offset == expectedLength);
                FileInformation after = Information(file, false);
                ExactSize(after, expectedLength);
                Require(SameIdentity(before, after) && before.Links == after.Links &&
                    SameTime(before.Creation, after.Creation) && SameTime(before.LastWrite, after.LastWrite));
                FinalPath(file, leaf);
                foreach (HeldDirectory directory in directories) {
                    Require(SameIdentity(directory.Before, Information(directory.Handle, true)));
                    FinalPath(directory.Handle, directory.Path);
                }
                return result;
            } finally {
                // SafeFileHandle owns CloseHandle; close every acquisition on all
                // paths. Last-access time is intentionally not an immutability test.
                for (int index = owned.Count - 1; index >= 0; index--) owned[index].Dispose();
            }
        }
    }
}
'@
    $bytes = [Yellow.MarketRegionalReadV1.NativeReader]::Read(
        $options['-RootDirectory'], $options['-RelativePath'], $expectedLength)
    $receipt = [ordered]@{
        format = 'yellow/market-regional-read/v1'
        byteLength = $bytes.Length
        bytesBase64 = [Convert]::ToBase64String($bytes)
    } | ConvertTo-Json -Compress
    [Console]::Out.WriteLine($receipt)
    exit 0
} catch {
    [Console]::Out.WriteLine('{"format":"yellow/market-regional-read/v1","error":"invalid_regional_snapshot"}')
    exit 1
}

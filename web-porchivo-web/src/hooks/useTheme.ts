/**
 * useTheme — re-exports next-themes' useTheme with proper typing.
 *
 * Returns: theme, setTheme, resolvedTheme, systemTheme
 * - theme: the user's preference ("light" | "dark" | "system")
 * - resolvedTheme: the actual rendered theme ("light" | "dark")
 * - systemTheme: what the OS prefers ("light" | "dark")
 */

export { useTheme } from "next-themes";

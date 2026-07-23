const publicBasePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

export function appHref(path: string) {
  return `${publicBasePath}${path}` || "/";
}

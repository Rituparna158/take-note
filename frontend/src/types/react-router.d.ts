import type { NavigateOptions, To } from "react-router-dom";

// This app only uses React Router in declarative mode (<BrowserRouter>), where
// navigate() always returns void. React Router's own types declare
// `void | Promise<void>` to also cover data-router/framework mode, which trips
// @typescript-eslint/no-floating-promises here. This narrows it back to void,
// per React Router's documented fix for BrowserRouter usage.
declare module "react-router-dom" {
  interface NavigateFunction {
    (to: To, options?: NavigateOptions): void;
    (delta: number): void;
  }
}

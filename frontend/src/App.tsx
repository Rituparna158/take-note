import { useEffect, useRef } from "react";

import { refresh } from "./features/auth/authApi.js";
import { AppRouter } from "./routes/AppRouter.js";

export function App() {
  const hasBootstrapped = useRef(false);

  useEffect(() => {
    if (hasBootstrapped.current) {
      return;
    }
    hasBootstrapped.current = true;
    void refresh();
  }, []);

  return <AppRouter />;
}

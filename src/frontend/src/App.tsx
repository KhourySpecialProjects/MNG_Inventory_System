import React, { useEffect, useState } from "react";

export default function App() {
  const [msg, setMsg] = useState("loading...");

  useEffect(() => {
    fetch("/trpc/hello?input=null")
      .then((r) => r.json())
      .then((d) => setMsg(d?.result?.data?.message ?? "no message"))
      .catch(() => setMsg("API not running"));
  }, []);

  return (
    <div style={{ padding: 24, fontFamily: "ui-sans-serif, system-ui" }}>
      <h1>Monorepo Boilerplate</h1>
      <p>API says: {msg}</p>
    </div>
  );
}

import { useState, useEffect } from "react";
import reactLogo from "./assets/react.svg";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import "./App.css";

interface ServerStatus {
  is_healthy: boolean;
  message: string;
}

function App() {
  const [greetMsg, setGreetMsg] = useState("");
  const [name, setName] = useState("");
  const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);

  useEffect(() => {
    const unlisten = listen<ServerStatus>("typesense-server-status", (event) => {
      setServerStatus(event.payload);
      console.log("Server status:", event.payload);
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []);

  async function greet() {
    // Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
    setGreetMsg(await invoke("greet", { name }));
  }

  return (
    <main className="container">
      <h1>Welcome to Tauri + React</h1>

      <div style={{
        padding: "10px",
        margin: "10px 0",
        borderRadius: "5px",
        backgroundColor: serverStatus?.is_healthy ? "#d4edda" : "#f8d7da",
        border: `1px solid ${serverStatus?.is_healthy ? "#c3e6cb" : "#f5c6cb"}`,
        color: serverStatus?.is_healthy ? "#155724" : "#721c24"
      }}>
        <strong>Typesense Server Status:</strong> {
          serverStatus ? (
            <>
              {serverStatus.is_healthy ? "🟢 Healthy" : "🔴 Unhealthy"} - {serverStatus.message}
            </>
          ) : (
            "⚪ Checking..."
          )
        }
      </div>

      <div className="row">
        <a href="https://vite.dev" target="_blank">
          <img src="/vite.svg" className="logo vite" alt="Vite logo" />
        </a>
        <a href="https://tauri.app" target="_blank">
          <img src="/tauri.svg" className="logo tauri" alt="Tauri logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <p>Click on the Tauri, Vite, and React logos to learn more.</p>

      <form
        className="row"
        onSubmit={(e) => {
          e.preventDefault();
          greet();
        }}
      >
        <input
          id="greet-input"
          onChange={(e) => setName(e.currentTarget.value)}
          placeholder="Enter a name..."
        />
        <button type="submit">Greet</button>
      </form>
      <p>{greetMsg}</p>
    </main>
  );
}

export default App;

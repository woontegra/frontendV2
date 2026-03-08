import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AuthProvider } from "@/context/AuthContext";
import { ToastProvider } from "@/context/ToastContext";
import { KaydetProvider } from "@/core/kaydet/KaydetProvider";
import { CaseProvider } from "@/contexts/CaseContext";
import App from "./App";
import "./index.css";

const savedTheme = localStorage.getItem("theme") || "light";
if (savedTheme === "dark") {
  document.documentElement.classList.add("dark");
}

if (!localStorage.getItem("tenant_id")) {
  localStorage.setItem("tenant_id", "1");
}

const client = new QueryClient();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <QueryClientProvider client={client}>
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <KaydetProvider>
            <CaseProvider>
              <App />
            </CaseProvider>
          </KaydetProvider>
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  </QueryClientProvider>
);

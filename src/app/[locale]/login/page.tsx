"use client";

import { Suspense } from "react";
import LoginContent from "./LoginContent";   // We'll create this next

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div style={{
        minHeight: "100vh",
        backgroundColor: "#05070C",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        color: "#64748B"
      }}>
        Loading...
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
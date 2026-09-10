import PrototypeApp from "./PrototypeApp";
import { Suspense } from "react";

export const metadata = {
  title: "Gigaprowl v1 UX prototype",
  description: "Throwaway, in-memory prototype of the Gigaprowl v1 product flow.",
};

export default function PrototypePage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100vh", background: "#08110E" }} />}>
      <PrototypeApp />
    </Suspense>
  );
}

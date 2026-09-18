import PrototypeApp from "./PrototypeApp";

export const metadata = {
  title: "Gigaprowl v1 UX prototype",
  description: "Throwaway, in-memory prototype of the Gigaprowl v1 product flow.",
};

export default function PrototypePage() {
  return (
    <>
      <link rel="preload" href="/fonts/Greed.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <PrototypeApp />
    </>
  );
}

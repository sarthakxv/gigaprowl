import ScoutPrototype from "./ScoutPrototype";

export const metadata = {
  title: "Scout · Gigaprowl v1 prototype",
  description: "An in-memory prototype of the Gigaprowl Scout experience.",
};

export default function ScoutPrototypePage() {
  return (
    <>
      <link rel="preload" href="/fonts/Greed.woff2" as="font" type="font/woff2" crossOrigin="anonymous" />
      <ScoutPrototype />
    </>
  );
}

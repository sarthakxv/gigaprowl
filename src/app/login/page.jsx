import { redirect } from "next/navigation";
import { getUserId } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function Login() {
  if (await getUserId()) redirect("/dashboard");
  return <LoginForm />;
}

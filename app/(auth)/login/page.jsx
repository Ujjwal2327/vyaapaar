import LoginForm from "@/components/auth/LoginForm";

export default function LoginPage() {
  return (
    <main className="min-h-screen mx-auto flex items-center justify-center p-6 sm:max-w-lg">
      <LoginForm redirectTo="/pricelist" />
    </main>
  );
}

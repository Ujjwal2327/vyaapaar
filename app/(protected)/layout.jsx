import { Protected } from "@/components/auth/Protected";

export default function ProtectedLayout({ children }) {
  return <Protected>{children}</Protected>;
}

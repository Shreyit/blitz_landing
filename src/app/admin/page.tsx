import { RegistrationAdmin } from "@/components/registration-admin";
import "./registrations.css";
export const metadata = {
  title: "Registration dashboard",
  robots: { index: false, follow: false },
};
export default function AdminPage() {
  return <RegistrationAdmin />;
}

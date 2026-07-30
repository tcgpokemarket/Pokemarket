import AdminGate from "../AdminGate";
import ApiManagementClient from "./ApiManagementClient";

export default function ApiManagementPage() {
  return (
    <AdminGate>
      <ApiManagementClient />
    </AdminGate>
  );
}

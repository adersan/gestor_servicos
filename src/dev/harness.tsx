import { createRoot } from "react-dom/client";

import { Dashboard } from "@/dashboard/Dashboard";
import { installMockBridge } from "@/dev/mockData";
import "@/index.css";

installMockBridge();

const root = document.getElementById("rdDashboardRoot");
if (root) createRoot(root).render(<Dashboard />);

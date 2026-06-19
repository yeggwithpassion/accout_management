import { createBrowserRouter, useRouteError } from "react-router";

function ErrorBoundary() {
  const error = useRouteError() as any;
  console.error(error);
  return (
    <div className="p-4 text-red-500">
      <h1 className="text-xl font-bold mb-2">出错了</h1>
      <pre className="bg-red-50 p-4 rounded overflow-auto">{error?.message || "Unknown error"}</pre>
    </div>
  );
}

import Login from "./pages/Login";

import { Layout } from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import SecuritiesAccounts from "./pages/SecuritiesAccounts";
import FundAccounts from "./pages/FundAccounts";

import { UserLayout } from "./components/UserLayout";
import UserDashboard from "./pages/user/UserDashboard";
import Transfer from "./pages/user/Transfer";
import ChangePassword from "./pages/user/ChangePassword";

export const router = createBrowserRouter([
  {
    path: "/login",
    Component: Login,
    errorElement: <ErrorBoundary />,
  },
  {
    path: "/",
    Component: Layout,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, Component: Dashboard },
      { path: "securities", Component: SecuritiesAccounts },
      { path: "funds", Component: FundAccounts },
    ],
  },
  {
    path: "/user",
    Component: UserLayout,
    errorElement: <ErrorBoundary />,
    children: [
      { index: true, Component: UserDashboard },
      { path: "transfer", Component: Transfer },
      { path: "password", Component: ChangePassword },
    ],
  }
]);
import { useContext } from "react";
import { AuthContext } from "./AuthContext.jsx";

export default function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth phải được sử dụng trong AuthProvider");
  return value;
}

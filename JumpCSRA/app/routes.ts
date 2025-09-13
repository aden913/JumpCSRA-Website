
import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("login.tsx"),
  route("home", "routes/home.tsx"),
  route("profile", "profile.tsx"),
] satisfies RouteConfig;

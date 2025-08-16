import type { Route } from "./+types/home";
import { Welcome } from "../welcome";

export function meta({}: Route.MetaArgs) {
  return [
    { title: "Jump CSRA  Party Rental" },
    { name: "description", content: "Landing page for Jump CSRA Party Rental!" },
  ];
}

export default function Home() {
  return <Welcome />;
}

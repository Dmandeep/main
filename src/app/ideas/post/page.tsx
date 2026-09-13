import { redirect } from "next/navigation";

export default function PostIdeaRedirect() {
  redirect("/ideas/new");
}

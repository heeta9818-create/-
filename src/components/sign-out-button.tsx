import { signOut } from "@/app/login/actions";

export function SignOutButton() {
  return (
    <form action={signOut}>
      <button
        type="submit"
        className="w-full rounded-lg border border-line bg-surface py-3.5 text-sm font-medium text-red-600"
      >
        로그아웃
      </button>
    </form>
  );
}

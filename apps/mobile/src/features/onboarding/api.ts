import type { Church } from "@church/database";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/api";
import type { AuthSession } from "@/stores/auth-store";

export type JoinableChurch = Pick<Church, "id" | "name" | "nameNe" | "address">;
export type RegisterInput = {
  email: string;
  password: string;
  fullName: string;
  phone: string;
  dateOfBirth: string;
  gender: "female" | "male" | "other" | "prefer_not_to_say";
  permanentAddress: string;
  temporaryAddress: string;
  churchId?: number;
};

export function useJoinableChurches() {
  return useQuery({
    queryKey: ["churches", "joinable"],
    queryFn: () => apiRequest<JoinableChurch[]>("/v1/churches/joinable"),
    staleTime: 5 * 60 * 1_000,
  });
}

export function useRegister() {
  return useMutation({ mutationFn: (input: RegisterInput) => apiRequest<AuthSession>("/v1/auth/register", { method: "POST", body: input }) });
}

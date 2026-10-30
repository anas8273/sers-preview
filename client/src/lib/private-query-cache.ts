import type { QueryClient, Query } from "@tanstack/react-query";

const isPrivateQuery = (query: Query) => {
  const path = query.queryKey[0];
  return !(Array.isArray(path) && path.length === 2 && path[0] === "auth" && path[1] === "me");
};
/** Preserve the current identity query, but cancel and remove all data obtained
 * under the previous identity, including requests that have not completed yet. */
export async function clearPrivateQueryCache(client: QueryClient) {
  await client.cancelQueries({ predicate: isPrivateQuery });
  client.removeQueries({ predicate: isPrivateQuery });
  client.getMutationCache().clear();
}

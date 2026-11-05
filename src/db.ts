import { openDB } from "idb";
import { emptyState, type State } from "./model";
const database = () =>
  openDB("stride-private", 1, {
    upgrade(db) {
      db.createObjectStore("journal");
    },
  });
export async function readState(): Promise<State> {
  const db = await database();
  return (await db.get("journal", "state")) ?? emptyState();
}
export async function writeState(state: State) {
  const db = await database();
  await db.put("journal", state, "state");
}
export async function deleteState() {
  const db = await database();
  await db.clear("journal");
}

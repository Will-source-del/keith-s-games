import { supabase } from "./supabase";
import { getPlayer } from "./player";

export async function loadGameSave(gameId: string) {
  const player = await getPlayer();

  const { data, error } = await supabase
    .from("game_saves")
    .select("game_data")
    .eq("user_id", player.id)
    .eq("game_id", gameId)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return data?.game_data ?? {};
}

export async function saveGame(
  gameId: string,
  gameData: Record<string, unknown>
) {
  const player = await getPlayer();

  const { error } = await supabase
    .from("game_saves")
    .upsert(
      {
        user_id: player.id,
        game_id: gameId,
        game_data: gameData,
        updated_at: new Date().toISOString()
      },
      {
        onConflict: "user_id,game_id"
      }
    );

  if (error) {
    throw error;
  }

  return true;
}

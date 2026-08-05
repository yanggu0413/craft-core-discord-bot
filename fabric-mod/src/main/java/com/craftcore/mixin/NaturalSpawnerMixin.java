package com.craftcore.mixin;

import com.craftcore.fish.FishingContestManager;
import net.minecraft.server.level.ServerLevel;
import net.minecraft.world.level.NaturalSpawner;
import net.minecraft.world.level.chunk.LevelChunk;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfo;

@Mixin(NaturalSpawner.class)
public class NaturalSpawnerMixin {
    @Inject(method = "spawnForChunk", at = @At("HEAD"), cancellable = true)
    private static void onSpawnForChunk(ServerLevel level, LevelChunk chunk, NaturalSpawner.SpawnState spawnState, boolean spawnFriendlies, boolean spawnMonsters, boolean spawnSpawners, CallbackInfo ci) {
        if (level != null && level.dimension().equals(FishingContestManager.FISHING_DIMENSION_KEY)) {
            ci.cancel();
        }
    }
}

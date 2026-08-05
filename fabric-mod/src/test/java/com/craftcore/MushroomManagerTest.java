package com.craftcore;

import com.craftcore.mushroom.MushroomManager;
import net.minecraft.core.component.DataComponents;
import net.minecraft.network.chat.Component;
import net.minecraft.world.item.ItemStack;
import net.minecraft.world.item.Items;
import net.minecraft.world.item.component.ItemLore;
import net.minecraft.world.item.component.ResolvableProfile;
import org.junit.jupiter.api.BeforeAll;
import org.junit.jupiter.api.Test;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;

public class MushroomManagerTest {

    static {
        try {
            net.minecraft.SharedConstants.tryDetectVersion();
            net.minecraft.server.Bootstrap.bootStrap();

            net.minecraft.core.HolderLookup.Provider provider = net.minecraft.core.HolderLookup.Provider.create(
                    net.minecraft.core.registries.BuiltInRegistries.REGISTRY.stream().map(r -> (net.minecraft.core.HolderLookup.RegistryLookup<?>) r)
            );

            net.minecraft.core.component.DataComponentInitializers initializers = new net.minecraft.core.component.DataComponentInitializers();
            java.util.List<net.minecraft.core.component.DataComponentInitializers.PendingComponents<?>> pending = initializers.build(provider);
            for (var p : pending) {
                try {
                    p.apply();
                } catch (Throwable t) {}
            }
        } catch (Throwable t) {}
        try {
            java.lang.reflect.Field field = net.minecraft.server.Bootstrap.class.getDeclaredField("initialized");
            field.setAccessible(true);
            field.set(null, true);
        } catch (Throwable t) {}
    }

    @Test
    public void testMushroomStackProperties() {
        ItemStack stack = MushroomManager.createMushroomStack();
        assertNotNull(stack);
        assertEquals(Items.PLAYER_HEAD, stack.getItem());

        // Name
        Component customName = stack.get(DataComponents.CUSTOM_NAME);
        assertNotNull(customName);
        assertEquals("§d【洋菇】", customName.getString());

        // Lore
        ItemLore lore = stack.get(DataComponents.LORE);
        assertNotNull(lore);
        List<String> lines = lore.lines().stream().map(Component::getString).toList();
        assertEquals(3, lines.size());
        assertEquals("§7這是一顆看起來非常鮮美的洋菇。", lines.get(0));
        assertEquals("§7但不知為何，總覺得哪裡怪怪的……", lines.get(1));
        assertEquals("§7真的沒打錯嗎？", lines.get(2));

        // Profile owner: im_little_rory
        ResolvableProfile profile = stack.get(DataComponents.PROFILE);
        assertNotNull(profile);
        assertTrue(profile.name().isPresent());
        assertEquals("im_little_rory", profile.name().get());

        // Glint override
        Boolean glint = stack.get(DataComponents.ENCHANTMENT_GLINT_OVERRIDE);
        assertNotNull(glint);
        assertTrue(glint);

        // Verification helper
        assertTrue(MushroomManager.isMushroom(stack));
        assertFalse(MushroomManager.isMushroom(new ItemStack(Items.DIAMOND)));
    }

    @Test
    public void testAiChatState() {
        assertFalse(MushroomManager.isAiChatActive(null));
    }
}

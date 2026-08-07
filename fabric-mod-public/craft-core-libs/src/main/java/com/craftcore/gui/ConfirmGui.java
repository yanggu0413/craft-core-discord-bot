package com.craftcore.gui;

import com.craftcore.util.ItemUtil;
import net.minecraft.server.level.ServerPlayer;
import net.minecraft.world.item.Items;

import java.util.List;

public class ConfirmGui extends BaseChestGui {
    private final String promptText;
    private final Runnable onConfirm;
    private final Runnable onCancel;

    public ConfirmGui(String title, String promptText, Runnable onConfirm, Runnable onCancel) {
        super(3, title != null ? title : "§c[ 確認操作 ]");
        this.promptText = promptText != null ? promptText : "是否確定要執行此操作？";
        this.onConfirm = onConfirm;
        this.onCancel = onCancel;
    }

    @Override
    protected void build(ServerPlayer player) {
        fillBackground(null);

        // Center Prompt (Slot 13)
        setItem(13, ItemUtil.createGuiItem(Items.PAPER, "§e❓ " + promptText, List.of("§7請確認是否繼續執行此操作？")), null);

        // Confirm Button (Slot 11)
        setButton(11, ItemUtil.createGuiItem(ItemUtil.getItem("minecraft:lime_stained_glass_pane"), "§a✔ 確認執行", List.of("§7點擊確認並執行")), () -> {
            player.closeContainer();
            if (onConfirm != null) {
                onConfirm.run();
            }
        });

        // Cancel Button (Slot 15)
        setButton(15, ItemUtil.createGuiItem(ItemUtil.getItem("minecraft:red_stained_glass_pane"), "§c❌ 取消操作", List.of("§7點擊放棄並返回")), () -> {
            player.closeContainer();
            if (onCancel != null) {
                onCancel.run();
            }
        });
    }
}

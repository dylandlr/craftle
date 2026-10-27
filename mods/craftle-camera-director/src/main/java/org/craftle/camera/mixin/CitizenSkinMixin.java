package org.craftle.camera.mixin;

import org.craftle.camera.CraftleCitizenSkins;
import net.minecraft.client.network.AbstractClientPlayerEntity;
import net.minecraft.client.util.SkinTextures;
import org.spongepowered.asm.mixin.Mixin;
import org.spongepowered.asm.mixin.injection.At;
import org.spongepowered.asm.mixin.injection.Inject;
import org.spongepowered.asm.mixin.injection.callback.CallbackInfoReturnable;

@Mixin(AbstractClientPlayerEntity.class)
public abstract class CitizenSkinMixin {
    @Inject(method="getSkinTextures",at=@At("HEAD"),cancellable=true)
    private void craftle$customCitizenSkin(CallbackInfoReturnable<SkinTextures> callback){
        AbstractClientPlayerEntity entity=(AbstractClientPlayerEntity)(Object)this;
        SkinTextures skin=CraftleCitizenSkins.skinFor(entity.getGameProfile().getName());
        if(skin!=null)callback.setReturnValue(skin);
    }
}

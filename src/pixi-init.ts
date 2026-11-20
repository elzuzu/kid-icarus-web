// Enregistrement explicite des pipes/systèmes de scène pixi.
// Leurs init.mjs sont éliminés du graphe statique de l'entrée au build :
// sans cet appel avant la création de l'Application, le renderer ignore
// graphics/text/particle/tilingSprite (TypeError validateRenderable).
import {
  extensions,
  GraphicsPipe,
  CanvasGraphicsPipe,
  GraphicsContextSystem,
  CanvasGraphicsContextSystem,
  CanvasRendererTextSystem,
  CanvasTextSystem,
  CanvasTextPipe,
  GlParticleContainerPipe,
  GpuParticleContainerPipe,
  CanvasParticleContainerPipe,
  TilingSpritePipe,
  CanvasTilingSpritePipe,
} from "pixi.js";

extensions.add(
  GraphicsPipe,
  CanvasGraphicsPipe,
  GraphicsContextSystem,
  CanvasGraphicsContextSystem,
  CanvasRendererTextSystem,
  CanvasTextSystem,
  CanvasTextPipe,
  GlParticleContainerPipe,
  GpuParticleContainerPipe,
  CanvasParticleContainerPipe,
  TilingSpritePipe,
  CanvasTilingSpritePipe,
);
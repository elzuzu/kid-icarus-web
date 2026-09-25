import{M as e,N as t,f as n,u as r,w as i,z as a}from"./CanvasPool-DecUtJxW.js";import{n as o}from"./unites-COHh3zfx.js";import{S as s,a as c,c as l,f as u,i as d,l as f,s as p,t as m}from"./Filter-CTLKor2l.js";import{t as h}from"./Cache-DDo62lBW.js";import{n as g}from"./CanvasRenderer-rh7xzlO-.js";import{o as _}from"./textures-ChrQ51XR.js";import{n as v}from"./BitmapFont-tJLClOv7.js";import"./index-KrBumLiE.js";var y=class e extends p{constructor(...e){let t=e[0];Array.isArray(e[0])&&(t={textures:e[0],autoUpdate:e[1]});let{animationSpeed:n=1,autoPlay:r=!1,autoUpdate:a=!0,loop:o=!0,onComplete:s=null,onFrameChange:c=null,onLoop:l=null,textures:u,updateAnchor:d=!1,...f}=t,[p]=u;super({...f,texture:p instanceof i?p:p.texture}),this._textures=null,this._durations=null,this._autoUpdate=a,this._isConnectedToTicker=!1,this.animationSpeed=n,this.loop=o,this.updateAnchor=d,this.onComplete=s,this.onFrameChange=c,this.onLoop=l,this._currentTime=0,this._playing=!1,this._previousFrame=null,this.textures=u,r&&this.play()}stop(){this._playing&&(this._playing=!1,this._autoUpdate&&this._isConnectedToTicker&&(d.shared.remove(this.update,this),this._isConnectedToTicker=!1))}play(){this._playing||(this._playing=!0,this._autoUpdate&&!this._isConnectedToTicker&&(d.shared.add(this.update,this,c.HIGH),this._isConnectedToTicker=!0))}gotoAndStop(e){this.stop(),this.currentFrame=e}gotoAndPlay(e){this.currentFrame=e,this.play()}update(e){if(!this._playing)return;let t=e.deltaTime,n=this.animationSpeed*t,r=this.currentFrame;if(this._durations!==null){let e=this._currentTime%1*this._durations[this.currentFrame];for(e+=n/60*1e3;e<0;)this._currentTime--,e+=this._durations[this.currentFrame];let r=Math.sign(this.animationSpeed*t);for(this._currentTime=Math.floor(this._currentTime);e>=this._durations[this.currentFrame];)e-=this._durations[this.currentFrame]*r,this._currentTime+=r;this._currentTime+=e/this._durations[this.currentFrame]}else this._currentTime+=n;this._currentTime<0&&!this.loop?(this.gotoAndStop(0),this.onComplete&&this.onComplete()):this._currentTime>=this._textures.length&&!this.loop?(this.gotoAndStop(this._textures.length-1),this.onComplete&&this.onComplete()):r!==this.currentFrame&&(this.loop&&this.onLoop&&(this.animationSpeed>0&&this.currentFrame<r||this.animationSpeed<0&&this.currentFrame>r)&&this.onLoop(),this._updateTexture())}_updateTexture(){let e=this.currentFrame;this._previousFrame!==e&&(this._previousFrame=e,this.texture=this._textures[e],this.updateAnchor&&this.texture.defaultAnchor&&this.anchor.copyFrom(this.texture.defaultAnchor),this.onFrameChange&&this.onFrameChange(this.currentFrame))}destroy(e=!1){if(typeof e==`boolean`?e:e?.texture){let t=typeof e==`boolean`?e:e?.textureSource;this._textures.forEach(e=>{this.texture!==e&&e.destroy(t)})}this._textures=[],this._durations=null,this.stop(),super.destroy(e),this.onComplete=null,this.onFrameChange=null,this.onLoop=null}static fromFrames(t){let n=[];for(let e=0;e<t.length;++e)n.push(i.from(t[e]));return new e(n)}static fromImages(t){let n=[];for(let e=0;e<t.length;++e)n.push(i.from(t[e]));return new e(n)}get totalFrames(){return this._textures.length}get textures(){return this._textures}set textures(e){if(e[0]instanceof i)this._textures=e,this._durations=null;else{this._textures=[],this._durations=[];for(let t=0;t<e.length;t++)this._textures.push(e[t].texture),this._durations.push(e[t].time)}this._previousFrame=null,this.gotoAndStop(0),this._updateTexture()}get currentFrame(){let e=Math.floor(this._currentTime)%this._textures.length;return e<0&&(e+=this._textures.length),e}set currentFrame(e){if(e<0||e>this.totalFrames-1)throw Error(`[AnimatedSprite]: Invalid frame index value ${e}, expected to be between 0 and totalFrames ${this.totalFrames}.`);let t=this.currentFrame;this._currentTime=e,t!==this.currentFrame&&this._updateTexture()}get playing(){return this._playing}get autoUpdate(){return this._autoUpdate}set autoUpdate(e){e!==this._autoUpdate&&(this._autoUpdate=e,!this._autoUpdate&&this._isConnectedToTicker?(d.shared.remove(this.update,this),this._isConnectedToTicker=!1):this._autoUpdate&&!this._isConnectedToTicker&&this._playing&&(d.shared.add(this.update,this),this._isConnectedToTicker=!0))}},ee=class{constructor({matrix:e,observer:t}={}){this.dirty=!0,this._matrix=e??new a,this.observer=t,this.position=new s(this,0,0),this.scale=new s(this,1,1),this.pivot=new s(this,0,0),this.skew=new s(this,0,0),this._rotation=0,this._cx=1,this._sx=0,this._cy=0,this._sy=1}get matrix(){let e=this._matrix;return this.dirty?(e.a=this._cx*this.scale.x,e.b=this._sx*this.scale.x,e.c=this._cy*this.scale.y,e.d=this._sy*this.scale.y,e.tx=this.position.x-(this.pivot.x*e.a+this.pivot.y*e.c),e.ty=this.position.y-(this.pivot.x*e.b+this.pivot.y*e.d),this.dirty=!1,e):e}_onUpdate(e){this.dirty=!0,e===this.skew&&this.updateSkew(),this.observer?._onUpdate(this)}updateSkew(){this._cx=Math.cos(this._rotation+this.skew.y),this._sx=Math.sin(this._rotation+this.skew.y),this._cy=-Math.sin(this._rotation-this.skew.x),this._sy=Math.cos(this._rotation-this.skew.x),this.dirty=!0}toString(){return`[pixi.js/math:Transform position=(${this.position.x}, ${this.position.y}) rotation=${this.rotation} scale=(${this.scale.x}, ${this.scale.y}) skew=(${this.skew.x}, ${this.skew.y}) ]`}setFromMatrix(e){e.decompose(this),this.dirty=!0}get rotation(){return this._rotation}set rotation(e){this._rotation!==e&&(this._rotation=e,this._onUpdate(this.skew))}},b=class n extends l{constructor(...r){let a=r[0]||{};a instanceof i&&(a={texture:a}),r.length>1&&(e(t,`use new TilingSprite({ texture, width:100, height:100 }) instead`),a.width=r[1],a.height=r[2]),a={...n.defaultOptions,...a};let{texture:o,anchor:c,tilePosition:l,tileScale:u,tileRotation:d,width:f,height:p,applyAnchorToTexture:m,roundPixels:h,...g}=a??{};super({label:`TilingSprite`,...g}),this.renderPipeId=`tilingSprite`,this.batched=!0,this.allowChildren=!1,this._anchor=new s({_onUpdate:()=>{this.onViewUpdate()}}),this.applyAnchorToTexture=m,this.texture=o,this._width=f??o.width,this._height=p??o.height,this._tileTransform=new ee({observer:{_onUpdate:()=>this.onViewUpdate()}}),c&&(this.anchor=c),this.tilePosition=l,this.tileScale=u,this.tileRotation=d,this.roundPixels=h??!1}static from(e,t={}){return typeof e==`string`?new n({texture:h.get(e),...t}):new n({texture:e,...t})}get uvRespectAnchor(){return e(t,`uvRespectAnchor is deprecated, please use applyAnchorToTexture instead`),this.applyAnchorToTexture}set uvRespectAnchor(n){e(t,`uvRespectAnchor is deprecated, please use applyAnchorToTexture instead`),this.applyAnchorToTexture=n}get clampMargin(){return this._texture.textureMatrix.clampMargin}set clampMargin(e){this._texture.textureMatrix.clampMargin=e}get anchor(){return this._anchor}set anchor(e){typeof e==`number`?this._anchor.set(e):this._anchor.copyFrom(e)}get tilePosition(){return this._tileTransform.position}set tilePosition(e){this._tileTransform.position.copyFrom(e)}get tileScale(){return this._tileTransform.scale}set tileScale(e){typeof e==`number`?this._tileTransform.scale.set(e):this._tileTransform.scale.copyFrom(e)}set tileRotation(e){this._tileTransform.rotation=e}get tileRotation(){return this._tileTransform.rotation}get tileTransform(){return this._tileTransform}set texture(e){e||=i.EMPTY;let t=this._texture;t!==e&&(t&&t.dynamic&&t.off(`update`,this.onViewUpdate,this),e.dynamic&&e.on(`update`,this.onViewUpdate,this),this._texture=e,this.onViewUpdate())}get texture(){return this._texture}set width(e){this._width=e,this.onViewUpdate()}get width(){return this._width}set height(e){this._height=e,this.onViewUpdate()}get height(){return this._height}setSize(e,t){typeof e==`object`&&(t=e.height??e.width,e=e.width),this._width=e,this._height=t??e,this.onViewUpdate()}getSize(e){return e||={},e.width=this._width,e.height=this._height,e}updateBounds(){let e=this._bounds,t=this._anchor,n=this._width,r=this._height;e.minX=-t._x*n,e.maxX=e.minX+n,e.minY=-t._y*r,e.maxY=e.minY+r}containsPoint(e){let t=this._width,n=this._height,r=-t*this._anchor._x,i=0;return e.x>=r&&e.x<=r+t&&(i=-n*this._anchor._y,e.y>=i&&e.y<=i+n)}destroy(e=!1){if(super.destroy(e),this._anchor=null,this._tileTransform=null,this._bounds=null,typeof e==`boolean`?e:e?.texture){let t=typeof e==`boolean`?e:e?.textureSource;this._texture.destroy(t)}this._texture=null}};b.defaultOptions={texture:i.EMPTY,anchor:{x:0,y:0},tilePosition:{x:0,y:0},tileScale:{x:1,y:1},tileRotation:0,applyAnchorToTexture:!1};var x=b,S=`in vec2 aPosition;
out vec2 vTextureCoord;

uniform vec4 uInputSize;
uniform vec4 uOutputFrame;
uniform vec4 uOutputTexture;

vec4 filterVertexPosition( void )
{
    vec2 position = aPosition * uOutputFrame.zw + uOutputFrame.xy;
    
    position.x = position.x * (2.0 / uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*uOutputTexture.z / uOutputTexture.y) - uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

vec2 filterTextureCoord( void )
{
    return aPosition * (uOutputFrame.zw * uInputSize.zw);
}

void main(void)
{
    gl_Position = filterVertexPosition();
    vTextureCoord = filterTextureCoord();
}
`,C=`struct GlobalFilterUniforms {
  uInputSize:vec4<f32>,
  uInputPixel:vec4<f32>,
  uInputClamp:vec4<f32>,
  uOutputFrame:vec4<f32>,
  uGlobalFrame:vec4<f32>,
  uOutputTexture:vec4<f32>,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;

struct VSOutput {
    @builtin(position) position: vec4<f32>,
    @location(0) uv : vec2<f32>
  };

fn filterVertexPosition(aPosition:vec2<f32>) -> vec4<f32>
{
    var position = aPosition * gfu.uOutputFrame.zw + gfu.uOutputFrame.xy;

    position.x = position.x * (2.0 / gfu.uOutputTexture.x) - 1.0;
    position.y = position.y * (2.0*gfu.uOutputTexture.z / gfu.uOutputTexture.y) - gfu.uOutputTexture.z;

    return vec4(position, 0.0, 1.0);
}

fn filterTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>
{
    return aPosition * (gfu.uOutputFrame.zw * gfu.uInputSize.zw);
}

fn globalTextureCoord( aPosition:vec2<f32> ) -> vec2<f32>
{
  return  (aPosition.xy / gfu.uGlobalFrame.zw) + (gfu.uGlobalFrame.xy / gfu.uGlobalFrame.zw);  
}

fn getSize() -> vec2<f32>
{
  return gfu.uGlobalFrame.zw;
}
  
@vertex
fn mainVertex(
  @location(0) aPosition : vec2<f32>, 
) -> VSOutput {
  return VSOutput(
   filterVertexPosition(aPosition),
   filterTextureCoord(aPosition)
  );
}`,w=`
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uOffset;

void main(void)
{
    vec4 color = vec4(0.0);

    // Sample top left pixel
    color += texture(uTexture, vec2(vTextureCoord.x - uOffset.x, vTextureCoord.y + uOffset.y));

    // Sample top right pixel
    color += texture(uTexture, vec2(vTextureCoord.x + uOffset.x, vTextureCoord.y + uOffset.y));

    // Sample bottom right pixel
    color += texture(uTexture, vec2(vTextureCoord.x + uOffset.x, vTextureCoord.y - uOffset.y));

    // Sample bottom left pixel
    color += texture(uTexture, vec2(vTextureCoord.x - uOffset.x, vTextureCoord.y - uOffset.y));

    // Average
    color *= 0.25;

    finalColor = color;
}`,T=`struct KawaseBlurUniforms {
  uOffset:vec2<f32>,
};

@group(0) @binding(1) var uTexture: texture_2d<f32>; 
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> kawaseBlurUniforms : KawaseBlurUniforms;

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv : vec2<f32>
) -> @location(0) vec4<f32> {
  let uOffset = kawaseBlurUniforms.uOffset;
  var color: vec4<f32> = vec4<f32>(0.0);

  // Sample top left pixel
  color += textureSample(uTexture, uSampler, vec2<f32>(uv.x - uOffset.x, uv.y + uOffset.y));
  // Sample top right pixel
  color += textureSample(uTexture, uSampler, vec2<f32>(uv.x + uOffset.x, uv.y + uOffset.y));
  // Sample bottom right pixel
  color += textureSample(uTexture, uSampler, vec2<f32>(uv.x + uOffset.x, uv.y - uOffset.y));
  // Sample bottom left pixel
  color += textureSample(uTexture, uSampler, vec2<f32>(uv.x - uOffset.x, uv.y - uOffset.y));
  // Average
  color *= 0.25;

  return color;
}`,E=`
precision highp float;
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform vec2 uOffset;

uniform vec4 uInputClamp;

void main(void)
{
    vec4 color = vec4(0.0);

    // Sample top left pixel
    color += texture(uTexture, clamp(vec2(vTextureCoord.x - uOffset.x, vTextureCoord.y + uOffset.y), uInputClamp.xy, uInputClamp.zw));

    // Sample top right pixel
    color += texture(uTexture, clamp(vec2(vTextureCoord.x + uOffset.x, vTextureCoord.y + uOffset.y), uInputClamp.xy, uInputClamp.zw));

    // Sample bottom right pixel
    color += texture(uTexture, clamp(vec2(vTextureCoord.x + uOffset.x, vTextureCoord.y - uOffset.y), uInputClamp.xy, uInputClamp.zw));

    // Sample bottom left pixel
    color += texture(uTexture, clamp(vec2(vTextureCoord.x - uOffset.x, vTextureCoord.y - uOffset.y), uInputClamp.xy, uInputClamp.zw));

    // Average
    color *= 0.25;

    finalColor = color;
}
`,D=`struct KawaseBlurUniforms {
  uOffset:vec2<f32>,
};

struct GlobalFilterUniforms {
  uInputSize:vec4<f32>,
  uInputPixel:vec4<f32>,
  uInputClamp:vec4<f32>,
  uOutputFrame:vec4<f32>,
  uGlobalFrame:vec4<f32>,
  uOutputTexture:vec4<f32>,
};

@group(0) @binding(0) var<uniform> gfu: GlobalFilterUniforms;

@group(0) @binding(1) var uTexture: texture_2d<f32>; 
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> kawaseBlurUniforms : KawaseBlurUniforms;

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv : vec2<f32>
) -> @location(0) vec4<f32> {
  let uOffset = kawaseBlurUniforms.uOffset;
  var color: vec4<f32> = vec4(0.0);

  // Sample top left pixel
  color += textureSample(uTexture, uSampler, clamp(vec2<f32>(uv.x - uOffset.x, uv.y + uOffset.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw));
  // Sample top right pixel
  color += textureSample(uTexture, uSampler, clamp(vec2<f32>(uv.x + uOffset.x, uv.y + uOffset.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw));
  // Sample bottom right pixel
  color += textureSample(uTexture, uSampler, clamp(vec2<f32>(uv.x + uOffset.x, uv.y - uOffset.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw));
  // Sample bottom left pixel
  color += textureSample(uTexture, uSampler, clamp(vec2<f32>(uv.x - uOffset.x, uv.y - uOffset.y), gfu.uInputClamp.xy, gfu.uInputClamp.zw));
  // Average
  color *= 0.25;
    
  return color;
}`,O=Object.defineProperty,k=(e,t,n)=>t in e?O(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n,A=(e,t,n)=>(k(e,typeof t==`symbol`?t:t+``,n),n),j=class t extends m{constructor(...i){let a=i[0]??{};(typeof a==`number`||Array.isArray(a))&&(e(`6.0.0`,`KawaseBlurFilter constructor params are now options object. See params: { strength, quality, clamp, pixelSize }`),a={strength:a},i[1]!==void 0&&(a.quality=i[1]),i[2]!==void 0&&(a.clamp=i[2])),a={...t.DEFAULT_OPTIONS,...a};let o=r.from({vertex:{source:C,entryPoint:`mainVertex`},fragment:{source:a?.clamp?D:T,entryPoint:`mainFragment`}}),s=n.from({vertex:S,fragment:a?.clamp?E:w,name:`kawase-blur-filter`});super({gpuProgram:o,glProgram:s,resources:{kawaseBlurUniforms:{uOffset:{value:new Float32Array(2),type:`vec2<f32>`}}}}),A(this,`uniforms`),A(this,`_pixelSize`,{x:0,y:0}),A(this,`_clamp`),A(this,`_kernels`,[]),A(this,`_blur`),A(this,`_quality`),this.uniforms=this.resources.kawaseBlurUniforms.uniforms,this.pixelSize=a.pixelSize??{x:1,y:1},Array.isArray(a.strength)?this.kernels=a.strength:typeof a.strength==`number`&&(this._blur=a.strength,this.quality=a.quality??3),this._clamp=!!a.clamp}apply(e,t,n,r){let i=this.pixelSizeX/t.source.width,a=this.pixelSizeY/t.source.height,o;if(this._quality===1||this._blur===0)o=this._kernels[0]+.5,this.uniforms.uOffset[0]=o*i,this.uniforms.uOffset[1]=o*a,e.applyFilter(this,t,n,r);else{let s=u.getSameSizeTexture(t),c=t,l=s,d,f=this._quality-1;for(let t=0;t<f;t++)o=this._kernels[t]+.5,this.uniforms.uOffset[0]=o*i,this.uniforms.uOffset[1]=o*a,e.applyFilter(this,c,l,!0),d=c,c=l,l=d;o=this._kernels[f]+.5,this.uniforms.uOffset[0]=o*i,this.uniforms.uOffset[1]=o*a,e.applyFilter(this,c,n,r),u.returnTexture(s)}}get strength(){return this._blur}set strength(e){this._blur=e,this._generateKernels()}get quality(){return this._quality}set quality(e){this._quality=Math.max(1,Math.round(e)),this._generateKernels()}get kernels(){return this._kernels}set kernels(e){Array.isArray(e)&&e.length>0?(this._kernels=e,this._quality=e.length,this._blur=Math.max(...e)):(this._kernels=[0],this._quality=1)}get pixelSize(){return this._pixelSize}set pixelSize(e){if(typeof e==`number`){this.pixelSizeX=this.pixelSizeY=e;return}if(Array.isArray(e)){this.pixelSizeX=e[0],this.pixelSizeY=e[1];return}this._pixelSize=e}get pixelSizeX(){return this.pixelSize.x}set pixelSizeX(e){this.pixelSize.x=e}get pixelSizeY(){return this.pixelSize.y}set pixelSizeY(e){this.pixelSize.y=e}get clamp(){return this._clamp}_updatePadding(){this.padding=Math.ceil(this._kernels.reduce((e,t)=>e+t+.5,0))}_generateKernels(){let e=this._blur,t=this._quality,n=[e];if(e>0){let r=e,i=e/t;for(let e=1;e<t;e++)r-=i,n.push(r)}this._kernels=n,this._updatePadding()}};A(j,`DEFAULT_OPTIONS`,{strength:4,quality:3,clamp:!1,pixelSize:{x:1,y:1}});var te=j,ne=`in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform sampler2D uMapTexture;
uniform float uBloomScale;
uniform float uBrightness;

void main() {
    vec4 color = texture(uTexture, vTextureCoord);
    color.rgb *= uBrightness;
    vec4 bloomColor = vec4(texture(uMapTexture, vTextureCoord).rgb, 0.0);
    bloomColor.rgb *= uBloomScale;
    finalColor = color + bloomColor;
}
`,M=`struct AdvancedBloomUniforms {
  uBloomScale: f32,
  uBrightness: f32,
};

@group(0) @binding(1) var uTexture: texture_2d<f32>; 
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> advancedBloomUniforms : AdvancedBloomUniforms;
@group(1) @binding(1) var uMapTexture: texture_2d<f32>;

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv : vec2<f32>
) -> @location(0) vec4<f32> {
  var color = textureSample(uTexture, uSampler, uv);
  color = vec4<f32>(color.rgb * advancedBloomUniforms.uBrightness, color.a);

  var bloomColor = vec4<f32>(textureSample(uMapTexture, uSampler, uv).rgb, 0.0);
  bloomColor = vec4<f32>(bloomColor.rgb * advancedBloomUniforms.uBloomScale, bloomColor.a);
  
  return color + bloomColor;
}
`,N=`
in vec2 vTextureCoord;
out vec4 finalColor;

uniform sampler2D uTexture;
uniform float uThreshold;

void main() {
    vec4 color = texture(uTexture, vTextureCoord);

    // A simple & fast algorithm for getting brightness.
    // It's inaccuracy , but good enought for this feature.
    float _max = max(max(color.r, color.g), color.b);
    float _min = min(min(color.r, color.g), color.b);
    float brightness = (_max + _min) * 0.5;

    if(brightness > uThreshold) {
        finalColor = color;
    } else {
        finalColor = vec4(0.0, 0.0, 0.0, 0.0);
    }
}
`,P=`struct ExtractBrightnessUniforms {
  uThreshold: f32,
};

@group(0) @binding(1) var uTexture: texture_2d<f32>; 
@group(0) @binding(2) var uSampler: sampler;
@group(1) @binding(0) var<uniform> extractBrightnessUniforms : ExtractBrightnessUniforms;

@fragment
fn mainFragment(
  @builtin(position) position: vec4<f32>,
  @location(0) uv : vec2<f32>
) -> @location(0) vec4<f32> {
  let color: vec4<f32> = textureSample(uTexture, uSampler, uv);

  // A simple & fast algorithm for getting brightness.
  // It's inaccurate, but good enough for this feature.
  let max: f32 = max(max(color.r, color.g), color.b);
  let min: f32 = min(min(color.r, color.g), color.b);
  let brightness: f32 = (max + min) * 0.5;

  return select(vec4<f32>(0.), color, brightness > extractBrightnessUniforms.uThreshold);
}
`,F=Object.defineProperty,I=(e,t,n)=>t in e?F(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n,L=(e,t,n)=>(I(e,typeof t==`symbol`?t:t+``,n),n),R=class e extends m{constructor(t){t={...e.DEFAULT_OPTIONS,...t};let i=r.from({vertex:{source:C,entryPoint:`mainVertex`},fragment:{source:P,entryPoint:`mainFragment`}}),a=n.from({vertex:S,fragment:N,name:`extract-brightness-filter`});super({gpuProgram:i,glProgram:a,resources:{extractBrightnessUniforms:{uThreshold:{value:t.threshold,type:`f32`}}}}),L(this,`uniforms`),this.uniforms=this.resources.extractBrightnessUniforms.uniforms}get threshold(){return this.uniforms.uThreshold}set threshold(e){this.uniforms.uThreshold=e}};L(R,`DEFAULT_OPTIONS`,{threshold:.5});var z=R,B=Object.defineProperty,V=(e,t,n)=>t in e?B(e,t,{enumerable:!0,configurable:!0,writable:!0,value:n}):e[t]=n,H=(e,t,n)=>(V(e,typeof t==`symbol`?t:t+``,n),n),U=class e extends m{constructor(t){t={...e.DEFAULT_OPTIONS,...t};let a=r.from({vertex:{source:C,entryPoint:`mainVertex`},fragment:{source:M,entryPoint:`mainFragment`}}),o=n.from({vertex:S,fragment:ne,name:`advanced-bloom-filter`});super({gpuProgram:a,glProgram:o,resources:{advancedBloomUniforms:{uBloomScale:{value:t.bloomScale,type:`f32`},uBrightness:{value:t.brightness,type:`f32`}},uMapTexture:i.WHITE}}),H(this,`uniforms`),H(this,`bloomScale`,1),H(this,`brightness`,1),H(this,`_extractFilter`),H(this,`_blurFilter`),this.uniforms=this.resources.advancedBloomUniforms.uniforms,this._extractFilter=new z({threshold:t.threshold}),this._blurFilter=new te({strength:t.kernels??t.blur,quality:t.kernels?void 0:t.quality}),Object.assign(this,t)}apply(e,t,n,r){let i=u.getSameSizeTexture(t);this._extractFilter.apply(e,t,i,!0);let a=u.getSameSizeTexture(t);this._blurFilter.apply(e,i,a,!0),this.uniforms.uBloomScale=this.bloomScale,this.uniforms.uBrightness=this.brightness,this.resources.uMapTexture=a.source,e.applyFilter(this,t,n,r),u.returnTexture(a),u.returnTexture(i)}get threshold(){return this._extractFilter.threshold}set threshold(e){this._extractFilter.threshold=e}get kernels(){return this._blurFilter.kernels}set kernels(e){this._blurFilter.kernels=e}get blur(){return this._blurFilter.strength}set blur(e){this._blurFilter.strength=e}get quality(){return this._blurFilter.quality}set quality(e){this._blurFilter.quality=e}get pixelSize(){return this._blurFilter.pixelSize}set pixelSize(e){typeof e==`number`&&(e={x:e,y:e}),Array.isArray(e)&&(e={x:e[0],y:e[1]}),this._blurFilter.pixelSize=e}get pixelSizeX(){return this._blurFilter.pixelSizeX}set pixelSizeX(e){this._blurFilter.pixelSizeX=e}get pixelSizeY(){return this._blurFilter.pixelSizeY}set pixelSizeY(e){this._blurFilter.pixelSizeY=e}};H(U,`DEFAULT_OPTIONS`,{threshold:.5,bloomScale:1,brightness:1,blur:8,quality:4,pixelSize:{x:1,y:1}});var W=U,G=function(e){return e[e.VIDE=0]=`VIDE`,e[e.SOLIDE=1]=`SOLIDE`,e[e.PLATEFORME=2]=`PLATEFORME`,e[e.PENTE_MONTANTE=3]=`PENTE_MONTANTE`,e[e.PENTE_DESCENDANTE=4]=`PENTE_DESCENDANTE`,e[e.PICS=5]=`PICS`,e[e.LAVE=6]=`LAVE`,e[e.FRIABLE=7]=`FRIABLE`,e[e.GRILLE=8]=`GRILLE`,e}({}),K={".":0,"#":1,"=":2,"/":3,"\\":4,"^":5,"~":6,"%":7,"|":8},q=class{id=``;nom=``;type=`vertical`;largeur=0;hauteur=0;boucle=!1;kit=``;musique=``;grille=new Uint8Array;depart={c:-1,l:-1};arrivees=[];checkpoints=[];portes=[];boss={c:-1,l:-1};marqueurs=[];definition={};annexe=null;annexeLigne=0;dimensionner(e,t){this.largeur=e,this.hauteur=t,this.grille=new Uint8Array(e*t)}dansGrille(e,t){return t>=0&&t<this.hauteur&&(this.boucle||e>=0&&e<this.largeur)}tuile(e,t){if(t<0&&this.annexe){let n=t-this.annexeLigne;return n>=0&&n<this.annexe.hauteur?this.annexe.tuile(e,n):0}if(t<0||t>=this.hauteur)return 0;if(this.boucle)e=(e%this.largeur+this.largeur)%this.largeur;else if(e<0||e>=this.largeur)return 1;return this.grille[t*this.largeur+e]}poser(e,t,n){this.grille[t*this.largeur+e]=n}estBloquant(e,t){let n=this.tuile(e,t);return n===1||n===7||n===8}estAppui(e,t){let n=this.tuile(e,t);return n===1||n===7||n===2||n===3||n===4}estDanger(e,t){let n=this.tuile(e,t);return n===5||n===6}tailleSalle(){let e=this.definition.salle??[0,0];return{c:Number(e[0]??0),l:Number(e[1]??0)}}salleDe(e){let t=this.tailleSalle();return t.c<=0?{c:-1,l:-1}:{c:Math.floor(e.c/t.c),l:Math.floor(e.l/t.l)}}largeurPx(){return this.largeur*16}hauteurPx(){return this.hauteur*16}};function J(e){let t=e.replace(/\r/g,``).split(`
`).map(e=>e.replace(/\s+$/,``));for(;t.length&&t[0]===``;)t.shift();for(;t.length&&t[t.length-1]===``;)t.pop();return t}function Y(e,t){let n=[],r=new q;if(r.definition=e,r.id=String(e.id??``),r.nom=String(e.nom??r.id),r.type=e.type??`vertical`,r.boucle=!!(e.boucle??r.type===`vertical`),r.kit=String(e.kit??``),r.musique=String(e.musique??``),t.length===0)return{niveau:r,erreurs:[`aucun chunk`]};let i;if(i=r.type===`horizontal`||r.type===`shmup`?re(t,n):X(t,Number(e.largeur??t[0]?.[0]?.length??0),n),n.length)return{niveau:r,erreurs:n};r.dimensionner(i[0]?.length??0,i.length);let a=e.marqueurs??{},o=e.portes??[],s=0;for(let e=r.hauteur-1;e>=0;e--){let t=i[e]??``;for(let i=0;i<r.largeur;i++){let c=t[i]??`.`,l={c:i,l:e},u=K[c];if(u!==void 0)r.poser(i,e,u);else if(c===`S`)r.depart.c!==-1&&n.push(`départ multiple (${r.depart.c},${r.depart.l} et ${i},${e})`),r.depart=l;else if(c===`G`)r.arrivees.push(l);else if(c===`C`)r.checkpoints.push(l);else if(c===`B`)r.boss=l;else if(c===`D`)r.portes.push({pos:l,chambre:o[s]??`hasard`}),s++;else if(c>=`a`&&c<=`z`){let t=a[c];t?r.marqueurs.push({car:c,pos:l,def:t}):n.push(`marqueur '${c}' non défini (ligne ${e}, colonne ${i})`)}else n.push(`caractère inconnu '${c}' (ligne ${e}, colonne ${i})`)}}r.depart.c===-1&&n.push(`aucun départ 'S'`);let c=r.type===`forteresse`||!!e.sans_arrivee;return!r.arrivees.length&&r.boss.c===-1&&!c&&n.push(`ni arrivée 'G' ni boss 'B'`),s<o.length&&n.push(`${o.length-s} porte(s) décrite(s) dans stage.json mais absente(s) de la carte`),{niveau:r,erreurs:n}}function X(e,t,n){let r=[];for(let i=e.length-1;i>=0;i--){let a=e[i]??[];a.forEach((e,r)=>{e.length!==t&&n.push(`chunk ${i} ligne ${r} : ${e.length} colonnes au lieu de ${t}`)}),r.push(...a)}return r}function re(e,t){let n=e[0]?.length??0,r=Array(n).fill(``);return e.forEach((e,i)=>{if(e.length!==n){t.push(`chunk ${i} : ${e.length} lignes au lieu de ${n}`);return}let a=e[0]?.length??0;e.forEach((e,n)=>{e.length!==a&&t.push(`chunk ${i} ligne ${n} : largeur irrégulière`),r[n]+=e})}),r}async function ie(e,t){let n=JSON.parse(await t(e)),r=e.replace(/[^/]+$/,``)+`chunks/`,i=n.chunks??[],{niveau:a,erreurs:o}=Y(n,await Promise.all(i.map(async e=>J(await t(`${r}${e}.txt`)))));if(o.length)throw Error(`${e} : ${o.join(` ; `)}`);return a}function Z(e,t,n,r){let i=[];for(let a=Math.max(0,n);a<Math.min(e.hauteur,r);a++){let n=0;for(;n<e.largeur;){if(e.tuile(n,a)!==t){n++;continue}let r=n;for(;n<e.largeur&&e.tuile(n,a)===t;)n++;i.push({l:a,c0:r,c1:n})}}return i}var Q=e=>e===G.SOLIDE||e===G.FRIABLE;function ae(e,t,n,r){let i=new f,a=new g,o=!1;for(let t=Math.max(0,n);t<Math.min(e.hauteur,r);t++)for(let n=0;n<e.largeur;n++)Q(e.tuile(n,t))&&(a.rect(n*64,t*64,64,64),o=!0);if(o){a.fill(16777215);let o=a.getLocalBounds(),s=new x({texture:t.bloc,width:o.width,height:o.height});s.position.set(o.x,o.y),s.tileScale.set(t.blocEchelle),s.tilePosition.set(-o.x,-o.y),s.mask=a,i.addChild(a,s);let c=new g;for(let i of Z(e,G.SOLIDE,n,r))for(let n=i.c0;n<i.c1;n++)if(!Q(e.tuile(n,i.l+1)))for(let e=0;e<4;e++)c.rect(n*64,(i.l+1)*64-(e+1)*8,64,8).fill({color:t.ombre,alpha:.12});i.addChild(c)}for(let a=Math.max(0,n);a<Math.min(e.hauteur,r);a++){let n=0;for(;n<e.largeur;){if(!Q(e.tuile(n,a))||Q(e.tuile(n,a-1))){n++;continue}let r=n;for(;n<e.largeur&&Q(e.tuile(n,a))&&!Q(e.tuile(n,a-1));)n++;let o=new x({texture:t.bordHaut,width:(n-r)*64,height:t.bordHautHauteur}),s=t.bordHautHauteur/t.bordHaut.height;o.tileScale.set(s),o.tilePosition.x=-r*64,o.position.set(r*64,a*64-t.bordHautSurface*t.bordHautHauteur),i.addChild(o)}}for(let a of Z(e,G.PLATEFORME,n,r))i.addChild(oe(t,a));return i}function oe(e,t){let n=e.plateformeHauteur,r=n/e.plateformeMilieu.height,i=new p(e.plateformeGauche),a=new p(e.plateformeDroite);i.scale.set(n/e.plateformeGauche.height),a.scale.set(n/e.plateformeDroite.height);let o=(t.c1-t.c0)*64,s=11.52,c=o+2*s,l=Math.min(i.width,c*.45),u=Math.min(a.width,c*.45);i.width=l,a.width=u;let d=new x({texture:e.plateformeMilieu,width:Math.max(0,c-l-u+4),height:n});d.tileScale.set(r),d.tilePosition.x=-t.c0*64*.73;let m=new f;return i.position.set(0,0),d.position.set(l-2,0),a.position.set(c-u,0),m.addChild(d,i,a),m.position.set(t.c0*64-s,t.l*64-e.plateformeSurface*n),m}var $=`"Segoe UI", "Trebuchet MS", sans-serif`,se=class extends f{icones;coeurs=[];jauge=new g;texteFleches;comptes=[];styleChiffres=new v({fontFamily:$,fontSize:30,fontWeight:`600`,fill:16052196,dropShadow:{color:0,alpha:.85,blur:3,distance:2,angle:Math.PI/2}});constructor(e,t=6){super(),this.icones=e;for(let n=0;n<t;n++){let t=new p(e.coeur);t.anchor.set(.5),t.height=40,t.scale.x=t.scale.y,t.position.set(58+n*44,56),this.coeurs.push(t),this.addChild(t)}this.addChild(this.jauge);let n=new p(e.coeur);n.anchor.set(.5),n.height=38,n.scale.x=n.scale.y,n.position.set(80,140),this.addChild(n),this.texteFleches=new _({text:``,style:this.styleChiffres}),this.texteFleches.anchor.set(0,.5),this.texteFleches.position.set(132,142),this.addChild(this.texteFleches),[[e.aile,`LB`],[e.etoile,`Y`],[e.fiole,`RB`]].forEach(([e,t],n)=>this.emplacement(o-320+n*108,58,e,t,n))}emplacement(e,t,n,r,i){let a=new f,o=new g;o.roundRect(-36,-36,72,72,10).fill({color:789780,alpha:.82}),o.roundRect(-36,-36,72,72,10).stroke({color:13225174,width:2.5,alpha:.95}),o.roundRect(-31,-31,62,62,7).stroke({color:7172997,width:1.2,alpha:.8}),a.addChild(o);let s=new p(n);s.anchor.set(.5);let c=54/Math.max(n.width,n.height);s.scale.set(c),a.addChild(s);let l=new _({text:``,style:this.styleChiffres.clone()});l.style.fontSize=24,l.anchor.set(1,1),l.position.set(33,36),a.addChild(l),this.comptes[i]=l;let u=new g;u.roundRect(-18,46,36,22,11).fill({color:1316383,alpha:.9}).stroke({color:11449282,width:1.5}),a.addChild(u);let d=new _({text:r,style:new v({fontFamily:$,fontSize:14,fontWeight:`700`,fill:15263982})});d.anchor.set(.5),d.position.set(0,57),a.addChild(d),a.position.set(e,t),this.addChild(a)}afficher(e){let t=e.pvMax/this.coeurs.length;this.coeurs.forEach((n,r)=>{n.texture=e.pv>=(r+1)*t-1e-6?this.icones.coeur:this.icones.coeurVide});let n=this.jauge;n.clear(),n.roundRect(34,84,258,24,6).fill({color:658194,alpha:.85}).stroke({color:12172745,width:2});let r=Math.max(0,Math.min(1,e.vol))*250;r>0&&(n.roundRect(38,88,r,16,4).fill(3116287),n.roundRect(38,88,r,7.2,3).fill({color:12575487,alpha:.55})),this.texteFleches.text=String(e.monnaie);let[,i,a]=this.comptes;i&&(i.text=e.pouvoirCharges>0?String(e.pouvoirCharges):``),a&&(a.text=e.fioles>0?String(e.fioles):``)}};export{G as a,y as c,Y as i,ae as n,W as o,ie as r,x as s,se as t};
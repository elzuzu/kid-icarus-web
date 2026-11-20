import {
  Filter,
  GlProgram,
  GpuProgram,
  Texture,
  TexturePool,
  deprecation,
} from "pixi.js";

const vertexGl = `in vec2 aPosition;
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
`;

const vertexWgsl = `struct GlobalFilterUniforms {
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
}`;

const kawaseGl = `
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
}`;

const kawaseWgsl = `struct KawaseBlurUniforms {
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
}`;

const kawaseGlClamp = `
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
`;

const kawaseWgslClamp = `struct KawaseBlurUniforms {
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
}`;

export class KawaseBlurFilter extends Filter {
  static DEFAULT_OPTIONS = {
    strength: 4,
    quality: 3,
    clamp: false,
    pixelSize: { x: 1, y: 1 },
  };

  uniforms: any;
  _pixelSize: any = { x: 0, y: 0 };
  _clamp: boolean;
  _kernels: number[] = [];
  _blur: number;
  _quality: number;

  constructor(...args: any[]) {
    let options = args[0] ?? {};
    if (typeof options === "number" || Array.isArray(options)) {
      deprecation(
        "6.0.0",
        "KawaseBlurFilter constructor params are now options object. See params: { strength, quality, clamp, pixelSize }",
      );
      options = { strength: options };
      if (args[1] !== undefined) options.quality = args[1];
      if (args[2] !== undefined) options.clamp = args[2];
    }
    options = { ...KawaseBlurFilter.DEFAULT_OPTIONS, ...options };
    const gpuProgram = GpuProgram.from({
      vertex: { source: vertexWgsl, entryPoint: "mainVertex" },
      fragment: {
        source: options?.clamp ? kawaseWgslClamp : kawaseWgsl,
        entryPoint: "mainFragment",
      },
    });
    const glProgram = GlProgram.from({
      vertex: vertexGl,
      fragment: options?.clamp ? kawaseGlClamp : kawaseGl,
      name: "kawase-blur-filter",
    });
    super({
      gpuProgram,
      glProgram,
      resources: {
        kawaseBlurUniforms: {
          uOffset: { value: new Float32Array(2), type: "vec2<f32>" },
        },
      },
    });
    this.uniforms = this.resources.kawaseBlurUniforms.uniforms;
    this.pixelSize = options.pixelSize ?? { x: 1, y: 1 };
    if (Array.isArray(options.strength)) this.kernels = options.strength;
    else if (typeof options.strength === "number") {
      this._blur = options.strength;
      this.quality = options.quality ?? 3;
    }
    this._clamp = !!options.clamp;
  }

  apply(filterManager: any, input: any, output: any, clear: boolean) {
    const ratioX = this.pixelSizeX / input.source.width;
    const ratioY = this.pixelSizeY / input.source.height;
    let offset;
    if (this._quality === 1 || this._blur === 0) {
      offset = this._kernels[0] + 0.5;
      this.uniforms.uOffset[0] = offset * ratioX;
      this.uniforms.uOffset[1] = offset * ratioY;
      filterManager.applyFilter(this, input, output, clear);
    } else {
      const texture = TexturePool.getSameSizeTexture(input);
      let courant = input;
      let suivant = texture;
      let tampon;
      const dernier = this._quality - 1;
      for (let i = 0; i < dernier; i++) {
        offset = this._kernels[i] + 0.5;
        this.uniforms.uOffset[0] = offset * ratioX;
        this.uniforms.uOffset[1] = offset * ratioY;
        filterManager.applyFilter(this, courant, suivant, true);
        tampon = courant;
        courant = suivant;
        suivant = tampon;
      }
      offset = this._kernels[dernier] + 0.5;
      this.uniforms.uOffset[0] = offset * ratioX;
      this.uniforms.uOffset[1] = offset * ratioY;
      filterManager.applyFilter(this, courant, output, clear);
      TexturePool.returnTexture(texture);
    }
  }

  get strength() {
    return this._blur;
  }
  set strength(value: number) {
    this._blur = value;
    this._generateKernels();
  }

  get quality() {
    return this._quality;
  }
  set quality(value: number) {
    this._quality = Math.max(1, Math.round(value));
    this._generateKernels();
  }

  get kernels() {
    return this._kernels;
  }
  set kernels(value: number[]) {
    if (Array.isArray(value) && value.length > 0) {
      this._kernels = value;
      this._quality = value.length;
      this._blur = Math.max(...value);
    } else {
      this._kernels = [0];
      this._quality = 1;
    }
  }

  get pixelSize() {
    return this._pixelSize;
  }
  set pixelSize(value: any) {
    if (typeof value === "number") {
      this.pixelSizeX = this.pixelSizeY = value;
      return;
    }
    if (Array.isArray(value)) {
      this.pixelSizeX = value[0];
      this.pixelSizeY = value[1];
      return;
    }
    this._pixelSize = value;
  }

  get pixelSizeX() {
    return this.pixelSize.x;
  }
  set pixelSizeX(value: number) {
    this.pixelSize.x = value;
  }

  get pixelSizeY() {
    return this.pixelSize.y;
  }
  set pixelSizeY(value: number) {
    this.pixelSize.y = value;
  }

  get clamp() {
    return this._clamp;
  }

  _updatePadding() {
    this.padding = Math.ceil(
      this._kernels.reduce((somme, noyau) => somme + noyau + 0.5, 0),
    );
  }

  _generateKernels() {
    const blur = this._blur;
    const quality = this._quality;
    const kernels = [blur];
    if (blur > 0) {
      let noyau = blur;
      const pas = blur / quality;
      for (let i = 1; i < quality; i++) {
        noyau -= pas;
        kernels.push(noyau);
      }
    }
    this._kernels = kernels;
    this._updatePadding();
  }
}

const bloomGl = `in vec2 vTextureCoord;
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
`;

const bloomWgsl = `struct AdvancedBloomUniforms {
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
`;

const extractGl = `
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
`;

const extractWgsl = `struct ExtractBrightnessUniforms {
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
`;

export class ExtractBrightnessFilter extends Filter {
  static DEFAULT_OPTIONS = { threshold: 0.5 };

  uniforms: any;

  constructor(options?: any) {
    options = { ...ExtractBrightnessFilter.DEFAULT_OPTIONS, ...options };
    const gpuProgram = GpuProgram.from({
      vertex: { source: vertexWgsl, entryPoint: "mainVertex" },
      fragment: { source: extractWgsl, entryPoint: "mainFragment" },
    });
    const glProgram = GlProgram.from({
      vertex: vertexGl,
      fragment: extractGl,
      name: "extract-brightness-filter",
    });
    super({
      gpuProgram,
      glProgram,
      resources: {
        extractBrightnessUniforms: {
          uThreshold: { value: options.threshold, type: "f32" },
        },
      },
    });
    this.uniforms = this.resources.extractBrightnessUniforms.uniforms;
  }

  get threshold() {
    return this.uniforms.uThreshold;
  }
  set threshold(value: number) {
    this.uniforms.uThreshold = value;
  }
}

export class AdvancedBloomFilter extends Filter {
  static DEFAULT_OPTIONS = {
    threshold: 0.5,
    bloomScale: 1,
    brightness: 1,
    blur: 8,
    quality: 4,
    pixelSize: { x: 1, y: 1 },
  };

  uniforms: any;
  bloomScale = 1;
  brightness = 1;
  _extractFilter: ExtractBrightnessFilter;
  _blurFilter: KawaseBlurFilter;

  constructor(options?: any) {
    options = { ...AdvancedBloomFilter.DEFAULT_OPTIONS, ...options };
    const gpuProgram = GpuProgram.from({
      vertex: { source: vertexWgsl, entryPoint: "mainVertex" },
      fragment: { source: bloomWgsl, entryPoint: "mainFragment" },
    });
    const glProgram = GlProgram.from({
      vertex: vertexGl,
      fragment: bloomGl,
      name: "advanced-bloom-filter",
    });
    super({
      gpuProgram,
      glProgram,
      resources: {
        advancedBloomUniforms: {
          uBloomScale: { value: options.bloomScale, type: "f32" },
          uBrightness: { value: options.brightness, type: "f32" },
        },
        uMapTexture: Texture.WHITE,
      },
    });
    this.uniforms = this.resources.advancedBloomUniforms.uniforms;
    this._extractFilter = new ExtractBrightnessFilter({
      threshold: options.threshold,
    });
    this._blurFilter = new KawaseBlurFilter({
      strength: options.kernels ?? options.blur,
      quality: options.kernels ? undefined : options.quality,
    });
    Object.assign(this, options);
  }

  apply(filterManager: any, input: any, output: any, clear: boolean) {
    const extractTexture = TexturePool.getSameSizeTexture(input);
    this._extractFilter.apply(filterManager, input, extractTexture, true);
    const bloomTexture = TexturePool.getSameSizeTexture(input);
    this._blurFilter.apply(filterManager, extractTexture, bloomTexture, true);
    this.uniforms.uBloomScale = this.bloomScale;
    this.uniforms.uBrightness = this.brightness;
    this.resources.uMapTexture = bloomTexture.source;
    filterManager.applyFilter(this, input, output, clear);
    TexturePool.returnTexture(bloomTexture);
    TexturePool.returnTexture(extractTexture);
  }

  get threshold() {
    return this._extractFilter.threshold;
  }
  set threshold(value: number) {
    this._extractFilter.threshold = value;
  }

  get kernels() {
    return this._blurFilter.kernels;
  }
  set kernels(value: number[]) {
    this._blurFilter.kernels = value;
  }

  get blur() {
    return this._blurFilter.strength;
  }
  set blur(value: number) {
    this._blurFilter.strength = value;
  }

  get quality() {
    return this._blurFilter.quality;
  }
  set quality(value: number) {
    this._blurFilter.quality = value;
  }

  get pixelSize() {
    return this._blurFilter.pixelSize;
  }
  set pixelSize(value: any) {
    if (typeof value === "number") value = { x: value, y: value };
    if (Array.isArray(value)) value = { x: value[0], y: value[1] };
    this._blurFilter.pixelSize = value;
  }

  get pixelSizeX() {
    return this._blurFilter.pixelSizeX;
  }
  set pixelSizeX(value: number) {
    this._blurFilter.pixelSizeX = value;
  }

  get pixelSizeY() {
    return this._blurFilter.pixelSizeY;
  }
  set pixelSizeY(value: number) {
    this._blurFilter.pixelSizeY = value;
  }
}
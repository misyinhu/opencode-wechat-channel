declare module "qrcode-terminal" {
  interface Options {
    small?: boolean;
  }
  function generate(text: string, options: Options, callback: (qr: string) => void): void;
  function generate(text: string, callback: (qr: string) => void): void;
  export = { generate };
}

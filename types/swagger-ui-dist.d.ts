declare module "swagger-ui-dist/swagger-ui-es-bundle.js" {
  const SwaggerUIBundle: (options: {
    url: string;
    domNode: HTMLElement;
    deepLinking?: boolean;
    tryItOutEnabled?: boolean;
  }) => unknown;
  export default SwaggerUIBundle;
}

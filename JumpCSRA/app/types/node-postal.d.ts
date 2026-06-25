declare module "node-postal" {
  export interface ParsedAddressComponent {
    label: string;
    value: string;
  }

  export interface PostalParser {
    parse_address(address: string): ParsedAddressComponent[];
  }

  export interface PostalExpand {
    expand_address(address: string): string[];
  }

  const postal: {
    parser: PostalParser;
    expand: PostalExpand;
  };

  export default postal;
}

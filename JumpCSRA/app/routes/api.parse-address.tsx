import { json, type ActionFunctionArgs } from "@remix-run/node";
import postal from "node-postal";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const address = formData.get("address") as string;

  if (!address) {
    return json({ error: "No address provided" }, { status: 400 });
  }

  try {
    console.log('🔍 [POSTAL API] Parsing address:', address);
    
    // Use node-postal to parse the address
    const parsed = postal.parser.parse_address(address);
    console.log('🔍 [POSTAL API] Parsed result:', JSON.stringify(parsed, null, 2));
    
    // Extract zip code from parsed components
    const zipComponent = parsed.find((component: any) => component.label === 'postcode');
    const zip = zipComponent ? zipComponent.value : null;
    
    console.log('🔍 [POSTAL API] Extracted zip:', zip);
    
    if (zip) {
      // Construct address with zip if it's not already there
      const hasZip = address.match(/\b\d{5}(?:-\d{4})?\b/);
      const addressWithZip = hasZip ? address : `${address} ${zip}`;
      
      return json({ 
        success: true,
        hasZip: true,
        address: addressWithZip,
        zip: zip,
        parsed: parsed // Include full parsed data for debugging
      });
    }

    // If no zip found, return original address
    return json({
      success: true,
      hasZip: false,
      address: address,
      zip: null,
      parsed: parsed
    });

  } catch (error) {
    console.error("Error parsing address:", error);
    return json({ error: "Failed to parse address", details: String(error) }, { status: 500 });
  }
}

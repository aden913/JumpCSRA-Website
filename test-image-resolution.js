// Test script to verify product image resolution
console.log("🖼️ Testing Product Image Resolution");
console.log("=".repeat(50));

// Mock inflateables data (subset from the actual data)
const mockInflateables = [
  {"name": "Sports Court", "img": "/assets/inflateables/sports-court.png"},
  {"name": "Adventure Island", "img": "/assets/inflateables/adventure-island.png"},
  {"name": "Castle Tower", "img": "/assets/inflateables/castle-tower.png"},
  {"name": "Axe Throwing", "img": "/assets/inflateables/axe-throwing.png"}
];

// Mock cart items (how they might be stored)
const mockCartItems = [
  {id: "Sports Court", name: "Sports Court", price: 175, wetDry: "Wet/Dry", quantity: 1},
  {id: "Adventure Island", name: "Adventure Island", price: 200, wetDry: "Wet", quantity: 1},
  {id: "Unknown Item", name: "Unknown Item", price: 100, wetDry: "Dry", quantity: 1}
];

// Simulate the getProductImage function
const getProductImage = (productName, inflateables) => {
  if (!productName) {
    console.warn('getProductImage: No product name provided');
    return '/assets/inflateables/default.png';
  }
  
  const product = inflateables.find(item => 
    item.name && item.name.toLowerCase() === productName.toLowerCase()
  );
  
  if (!product) {
    console.warn(`getProductImage: Product "${productName}" not found in inflateables data`);
    return '/assets/inflateables/default.png';
  }
  
  if (!product.img) {
    console.warn(`getProductImage: Product "${productName}" has no image path`);
    return '/assets/inflateables/default.png';
  }
  
  return product.img;
};

console.log("🧪 Testing image resolution for cart items:");
console.log();

mockCartItems.forEach((item, index) => {
  const imagePath = getProductImage(item.name, mockInflateables);
  const status = imagePath === '/assets/inflateables/default.png' ? '❌ DEFAULT' : '✅ FOUND';
  
  console.log(`${index + 1}. Product: "${item.name}"`);
  console.log(`   Image: ${imagePath}`);
  console.log(`   Status: ${status}`);
  console.log();
});

console.log("🎯 EXPECTED RESULTS:");
console.log("✅ Sports Court → /assets/inflateables/sports-court.png");
console.log("✅ Adventure Island → /assets/inflateables/adventure-island.png");
console.log("❌ Unknown Item → /assets/inflateables/default.png (fallback)");

console.log("\n📋 VERIFICATION:");
console.log("• Check that known products resolve to correct image paths");
console.log("• Check that unknown products fall back to default.png");
console.log("• Check that console warnings appear for missing products");
console.log("• Case-insensitive matching should work");
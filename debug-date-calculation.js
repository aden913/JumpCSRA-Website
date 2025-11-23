// Test the calculateFirstWeekdayInMonth logic
function calculateFirstWeekdayInMonth(weekday) {
  const today = new Date();
  const targetWeekday = ['monday', 'tuesday', 'wednesday', 'thursday'].indexOf(weekday.toLowerCase());
  
  console.log(`Input weekday: "${weekday}"`);
  console.log(`Target weekday index: ${targetWeekday}`);
  console.log(`Today: ${today.toString()}`);
  
  if (targetWeekday === -1) {
    console.log('❌ Invalid weekday');
    return today;
  }
  
  // Start from today and find the next first occurrence of weekday in a month
  let currentDate = new Date(today);
  
  console.log('\nSearching for first occurrence in month...');
  
  // Look ahead up to 4 months
  while (currentDate <= new Date(today.getTime() + 120 * 24 * 60 * 60 * 1000)) {
    const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const targetDay = targetWeekday + 1; // Convert to Date.getDay() format
    const dayOfMonth = currentDate.getDate();
    
    console.log(`Checking ${currentDate.toDateString()}: day of week = ${dayOfWeek}, target = ${targetDay}, day of month = ${dayOfMonth}`);
    
    // Check if this is the first occurrence of this weekday in the month (within first 7 days)
    if (dayOfWeek === targetDay && dayOfMonth <= 7) {
      // Check if it's at least 2 days in the future for delivery logistics
      const diffInDays = Math.ceil((currentDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      console.log(`✅ Found first ${weekday} in month: ${currentDate.toDateString()}`);
      console.log(`Days from today: ${diffInDays}`);
      
      if (diffInDays >= 2) {
        console.log(`✅ This date meets the 2-day minimum requirement`);
        return new Date(currentDate);
      } else {
        console.log(`❌ This date is too soon (< 2 days), continuing search...`);
      }
    }
    
    // Move to next day
    currentDate.setDate(currentDate.getDate() + 1);
  }
  
  console.log('❌ No suitable date found');
  return today; // Fallback if no suitable date found
}

// Test cases
console.log('=== TESTING calculateFirstWeekdayInMonth ===\n');

console.log('1. Testing "tuesday":');
const tuesdayDate = calculateFirstWeekdayInMonth('tuesday');
console.log(`Result: ${tuesdayDate.toDateString()}\n`);

console.log('2. Testing "monday":');
const mondayDate = calculateFirstWeekdayInMonth('monday');
console.log(`Result: ${mondayDate.toDateString()}\n`);

console.log('3. Testing "wednesday":');
const wednesdayDate = calculateFirstWeekdayInMonth('wednesday');
console.log(`Result: ${wednesdayDate.toDateString()}\n`);

// Check December 2025 calendar
console.log('=== DECEMBER 2025 CALENDAR CHECK ===');
const dec2025 = new Date(2025, 11, 1); // December 1, 2025
console.log(`December 1, 2025 is a: ${dec2025.toDateString()} (day of week: ${dec2025.getDay()})`);

const dec2nd = new Date(2025, 11, 2);
console.log(`December 2, 2025 is a: ${dec2nd.toDateString()} (day of week: ${dec2nd.getDay()})`);

const dec3rd = new Date(2025, 11, 3);
console.log(`December 3, 2025 is a: ${dec3rd.toDateString()} (day of week: ${dec3rd.getDay()})`);

console.log('\nDay mapping: 0=Sunday, 1=Monday, 2=Tuesday, 3=Wednesday, 4=Thursday, 5=Friday, 6=Saturday');
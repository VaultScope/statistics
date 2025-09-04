export function getGreeting(firstName: string): string {
  const hour = new Date().getHours();
  
  if (hour < 12) {
    return `Good Morning, ${firstName}`;
  } else if (hour < 18) {
    return `Good Afternoon, ${firstName}`;
  } else {
    return `Good Evening, ${firstName}`;
  }
}
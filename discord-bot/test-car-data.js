require('dotenv').config();
const Garage61Client = require('./modules/garage61-client');

(async () => {
    const client = new Garage61Client(process.env.GARAGE61_TOKEN);
    const cars = await client.getCars();
    
    console.log('Total cars:', cars.length);
    console.log('\nFirst 3 cars with full data:');
    console.log(JSON.stringify(cars.slice(0, 3), null, 2));
    
    // Check if class field exists
    const hasClass = cars.some(car => car.class || car.category || car.carClass);
    console.log('\n🔍 Has class/category field?', hasClass);
    
    if (hasClass) {
        const classes = [...new Set(cars.map(c => c.class || c.category || c.carClass).filter(Boolean))];
        console.log('\n📋 Available classes:', classes);
    }
})();

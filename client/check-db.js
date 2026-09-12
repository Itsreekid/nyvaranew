const postgres = require('postgres');
const sql = postgres('postgres://postgres:4ug2XHx1oJSbYHuLIUEc8VZY71wadx4rmUlOv4ObQdYW4sVyvb0Key4vwoHteWyZ@a7s6jhbprifzm5g9r2j5fe22:5432/postgres');
sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'products'`.then(res => {
  console.log(res);
  process.exit(0);
}).catch(err => {
  console.error(err);
  process.exit(1);
});

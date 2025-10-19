
exports.up = function(knex) {
  return knex.schema.createTable('advice', table => {
    table.increments('id').primary();
    table.integer('doctor_id').unsigned().notNullable().references('id').inTable('users');
    table.string('title').notNullable();
    table.text('body').notNullable();
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('advice');
};


exports.up = function(knex) {
  return knex.schema.createTable('question_votes', table => {
    table.increments('id').primary();
    table.integer('user_id').unsigned().notNullable().references('id').inTable('users').onDelete('CASCADE');
    table.integer('question_id').unsigned().notNullable().references('id').inTable('questions').onDelete('CASCADE');
    table.enum('vote_type', ['up', 'down']).notNullable();
    table.unique(['user_id', 'question_id']); // A user can only vote once per question
    table.timestamps(true, true);
  });
};

exports.down = function(knex) {
  return knex.schema.dropTable('question_votes');
};

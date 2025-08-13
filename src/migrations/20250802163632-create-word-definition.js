/** @type {import('sequelize-cli').Migration} */
export async function up(queryInterface, Sequelize) {
  await queryInterface.createTable("word_definitions", {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    definition: {
      type: Sequelize.TEXT,
      allowNull: false,
    },
    part_of_speech: {
      type: Sequelize.STRING,
      allowNull: false,
    },
    word_id: {
      type: Sequelize.INTEGER,
      allowNull: false,
      references: {
        model: "words",
        key: "id",
      },
      onDelete: "CASCADE",
      onUpdate: "CASCADE",
    },
    created_at: {
      allowNull: false,
      type: Sequelize.DATE,
    },
    updated_at: {
      allowNull: false,
      type: Sequelize.DATE,
    },
  });
}

export async function down(queryInterface, Sequelize) {
  await queryInterface.dropTable("word_definitions");
}

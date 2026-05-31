const { sequelize, User, Role, Category, Product, StockAlertSetting } = require('../models');

async function initDB() {
  try {
    await sequelize.authenticate();
    console.log('数据库连接成功');

    // 同步模型（强制重建表，索引会在模型定义中自动创建）
    await sequelize.sync({ force: true });
    console.log('数据库表重建完成（包含索引）');

    // 初始化角色
    const ownerRole = await Role.create({
      role_name: '店主',
      description: '系统管理员，拥有所有权限',
      permissions: JSON.stringify({
        product_manage: true,
        inbound_manage: true,
        inventory_manage: true,
        inventory_audit: true,
        stock_query: true,
        stock_value_query: true,
        analytics_query: true,
        alert_manage: true,
        log_query: true,
        permission_manage: true,
      }),
    });

    const clerkRole = await Role.create({
      role_name: '店员',
      description: '普通员工，部分权限',
      permissions: JSON.stringify({
        product_manage: false,
        inbound_manage: true,
        inventory_manage: true,
        inventory_audit: false,
        stock_query: true,
        stock_value_query: false,
        analytics_query: false,
        alert_manage: false,
        log_query: false,
        permission_manage: false,
      }),
    });

    // 初始化管理员（传入明文密码，由模型的beforeCreate钩子自动哈希）
    await User.create({
      username: 'admin',
      password: 'admin123',
      real_name: '某店主',
      phone: '13800138000',
      role_id: ownerRole.id,
    });

    // 初始化店员
    await User.create({
      username: 'clerk',
      password: 'clerk123',
      real_name: '某店员',
      phone: '13900139000',
      role_id: clerkRole.id,
    });

    // 初始化商品分类
    const categories = [
      { category_name: '模型玩偶', parent_id: 0, sort_order: 1 },
      { category_name: '手办', parent_id: 0, sort_order: 2 },
      { category_name: '积木拼装', parent_id: 0, sort_order: 3 },
      { category_name: '毛绒公仔', parent_id: 0, sort_order: 4 },
      { category_name: '益智玩具', parent_id: 0, sort_order: 5 },
      { category_name: '遥控模型', parent_id: 0, sort_order: 6 },
    ];
    const createdCategories = [];
    for (const cat of categories) {
      createdCategories.push(await Category.create(cat));
    }

    // 初始化示例商品
    const products = [
      { product_name: '钢铁侠MK50模型', category_id: createdCategories[0].id, cost_price: 120.00, retail_price: 258.00, stock_quantity: 15 },
      { product_name: '蝙蝠侠模型玩偶', category_id: createdCategories[0].id, cost_price: 98.00, retail_price: 199.00, stock_quantity: 8 },
      { product_name: '蜘蛛侠可动人偶', category_id: createdCategories[0].id, cost_price: 85.00, retail_price: 179.00, stock_quantity: 12 },
      { product_name: '美国队长盾牌模型', category_id: createdCategories[0].id, cost_price: 150.00, retail_price: 299.00, stock_quantity: 5 },
      { product_name: '龙珠超孙悟空手办', category_id: createdCategories[1].id, cost_price: 200.00, retail_price: 399.00, stock_quantity: 6 },
      { product_name: '海贼王路飞手办', category_id: createdCategories[1].id, cost_price: 180.00, retail_price: 359.00, stock_quantity: 10 },
      { product_name: '火影忍者鸣人手办', category_id: createdCategories[1].id, cost_price: 165.00, retail_price: 329.00, stock_quantity: 7 },
      { product_name: '乐高城市系列积木', category_id: createdCategories[2].id, cost_price: 90.00, retail_price: 189.00, stock_quantity: 20 },
      { product_name: '高达拼装模型RG', category_id: createdCategories[2].id, cost_price: 130.00, retail_price: 269.00, stock_quantity: 14 },
      { product_name: '皮卡丘毛绒公仔', category_id: createdCategories[3].id, cost_price: 45.00, retail_price: 99.00, stock_quantity: 30 },
      { product_name: '哆啦A梦毛绒公仔', category_id: createdCategories[3].id, cost_price: 50.00, retail_price: 109.00, stock_quantity: 25 },
      { product_name: '魔方三阶竞速', category_id: createdCategories[4].id, cost_price: 25.00, retail_price: 59.00, stock_quantity: 50 },
      { product_name: '遥控越野车1:16', category_id: createdCategories[5].id, cost_price: 160.00, retail_price: 329.00, stock_quantity: 8 },
    ];
    for (let i = 0; i < products.length; i++) {
      const sku_code = `KW-TOY-${String(i + 1).padStart(3, '0')}`;
      await Product.create({ ...products[i], sku_code });
    }

    // 初始化预警设置
    const alertProducts = [
      { product_sku: 'KW-TOY-002', threshold: 10 },  // 蝙蝠侠
      { product_sku: 'KW-TOY-004', threshold: 8 },   // 美国队长
      { product_sku: 'KW-TOY-005', threshold: 10 },  // 龙珠超
      { product_sku: 'KW-TOY-013', threshold: 10 },  // 遥控越野车
    ];
    for (const ap of alertProducts) {
      const product = await Product.findOne({ where: { sku_code: ap.product_sku } });
      if (product) {
        await StockAlertSetting.create({ product_id: product.id, alert_threshold: ap.threshold, is_active: 1 });
      }
    }

    console.log('\n===== 初始化完成 =====');
    console.log('管理员账号: admin / admin123');
    console.log('店员账号: clerk / clerk123');
    console.log('======================\n');

    process.exit(0);
  } catch (error) {
    console.error('初始化失败:', error);
    process.exit(1);
  }
}

initDB();

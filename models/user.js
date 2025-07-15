const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');
const bcrypt = require('bcryptjs');
const { logger } = require('../config/logger');

// 自定义错误类
class UserError extends Error {
    constructor(message, statusCode = 400) {
        super(message);
        this.name = 'UserError';
        this.statusCode = statusCode;
    }
}

class User {
    constructor({ id, username, passwordhash, createdAt }) {
        this.id = id;
        this.username = username;
        this.passwordhash = passwordhash;
        this.createdAt = createdAt || new Date();
    }

    static async init() {
        // 使用共享的数据库连接
        this.model = sequelize.define('User', {
            id: {
                type: DataTypes.INTEGER,
                primaryKey: true,
                autoIncrement: true
            },
            username: {
                type: DataTypes.STRING(50),
                allowNull: false,
                unique: true,
                validate: {
                    len: [3, 50],
                    is: /^[a-zA-Z0-9_]+$/
                }
            },
            passwordhash: {
                type: DataTypes.STRING(255),
                allowNull: false
            }
        }, {
            tableName: 'users',
            timestamps: true
        });
    }

    // 数据验证方法
    static validateUserData(username, password) {
        if (!username || typeof username !== 'string') {
            throw new UserError('用户名是必需的且必须是字符串');
        }
        
        if (username.length < 3 || username.length > 50) {
            throw new UserError('用户名长度必须在3-50字符之间');
        }
        
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
            throw new UserError('用户名只能包含字母、数字和下划线');
        }
        
        if (!password || typeof password !== 'string') {
            throw new UserError('密码是必需的且必须是字符串');
        }
        
        if (password.length < 6) {
            throw new UserError('密码长度至少为6个字符');
        }
        
        if (password.length > 128) {
            throw new UserError('密码长度不能超过128个字符');
        }
    }

    static async create(username, password) {
        try {
            // 数据验证
            this.validateUserData(username, password);
            
            // 检查用户名是否已存在
            const existingUser = await this.findByUsername(username);
            if (existingUser) {
                throw new UserError('用户名已存在', 409);
            }
            
            // 密码加密
            const passwordhash = await bcrypt.hash(password, 12);
            
            // 创建用户
            const dbUser = await this.model.create({
                username,
                passwordhash
            });
            
            return new User(dbUser.toJSON());
        } catch (error) {
            if (error instanceof UserError) {
                throw error;
            }
            // 添加更详细的错误信息
            logger.error('用户创建错误详情:', error);
            throw new UserError(`创建用户失败: ${error.message}`);
        }
    }

    static async findByUsername(username) {
        try {
            if (!username || typeof username !== 'string') {
                throw new UserError('用户名参数无效');
            }
            
            const user = await this.model.findOne({
                where: { username }
            });
            
            return user ? new User(user.toJSON()) : null;
        } catch (error) {
            if (error instanceof UserError) {
                throw error;
            }
            throw new UserError(`查找用户失败: ${error.message}`);
        }
    }

    static async findById(id) {
        try {
            if (!id || isNaN(Number(id))) {
                throw new UserError('用户ID参数无效');
            }
            
            const user = await this.model.findByPk(id);
            return user ? new User(user.toJSON()) : null;
        } catch (error) {
            if (error instanceof UserError) {
                throw error;
            }
            throw new UserError(`查找用户失败: ${error.message}`);
        }
    }

    static async verifyPassword(username, password) {
        try {
            if (!username || !password) {
                throw new UserError('用户名和密码都是必需的');
            }
            
            const user = await this.findByUsername(username);
            if (!user) {
                return null;
            }
            
            const isValid = await bcrypt.compare(password, user.passwordhash);
            return isValid ? { id: user.id, username: user.username } : null;
        } catch (error) {
            if (error instanceof UserError) {
                throw error;
            }
            throw new UserError(`密码验证失败: ${error.message}`);
        }
    }

    static async delete(id) {
        try {
            if (!id || isNaN(Number(id))) {
                throw new UserError('用户ID参数无效');
            }
            
            // 检查用户是否存在
            const user = await this.findById(id);
            if (!user) {
                // 不抛异常，直接返回false
                return false;
            }
            
            const result = await this.model.destroy({
                where: { id }
            });
            
            return result > 0;
        } catch (error) {
            if (error instanceof UserError) {
                throw error;
            }
            throw new UserError(`删除用户失败: ${error.message}`);
        }
    }

    // 批量操作
    static async createBatch(users) {
        const transaction = await sequelize.transaction();
        
        try {
            const createdUsers = [];
            
            for (const userData of users) {
                this.validateUserData(userData.username, userData.password);
                
                const passwordhash = await bcrypt.hash(userData.password, 12);
                const user = await this.model.create({
                    username: userData.username,
                    passwordhash
                }, { transaction });
                
                createdUsers.push(new User(user.toJSON()));
            }
            
            await transaction.commit();
            return createdUsers;
        } catch (error) {
            await transaction.rollback();
            if (error instanceof UserError) {
                throw error;
            }
            throw new UserError(`批量创建用户失败: ${error.message}`);
        }
    }
}

module.exports = { User, UserError };
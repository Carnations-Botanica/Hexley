import { DataTypes, Op } from 'sequelize';
import path from 'path';

// Define the structure of our firewall settings table.
const firewallConfigTable = {
    definition: {
        setting: {
            type: DataTypes.STRING(191),
            allowNull: false,
            primaryKey: true
        },
        value: {
            type: DataTypes.STRING(255),
            allowNull: false,
        }
    },
    options: {
        tableName: 'firewallConfigTable',
        timestamps: false
    }
};

// Define the structure for tracking IPs that have contacted the server.
const firewallMetIPsTable = {
    definition: {
        ipAddress: {
            type: DataTypes.STRING(191),
            allowNull: false,
            primaryKey: true
        },
        contactCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1
        },
        isWhitelisted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        isBlacklisted: {
            type: DataTypes.BOOLEAN,
            defaultValue: false
        },
        rateLimitedUntil: {
            type: DataTypes.DATE,
            allowNull: true
        },
        firstSeen: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        lastSeen: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW
        },
        lastPathRequested: {
            type: DataTypes.STRING(255),
            allowNull: true
        }
    },
    options: {
        tableName: 'firewallMetIPsTable',
        timestamps: false
    }
};

/**
 * The globally accessible framework for managing network security and traffic.
 */
export const firewallFramework = {

    frameworkColor: "#FF6347", // Tomato Red for security/warnings

    /**
     * Initializes the Firewall Framework, its database tables, and default settings.
     * @param {any} Hexley - The main Hexley global object.
     */
    async initializeFirewall(Hexley: any) {
        Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} Initializing...`);
        
        if (Hexley.databaseLoaded) {
            await Hexley.frameworks.database.initTable(firewallConfigTable);
            await Hexley.frameworks.database.initTable(firewallMetIPsTable);

            await this._seedDefaultSettings(Hexley);

            Hexley.core.once('registryFramework.ready', () => {
                const plistPath = path.join(Hexley.privateFrameworksRootPath, 'firewallFramework', 'info.plist');
                Hexley.frameworks.registry.addEntryByPlist(Hexley, plistPath);
            });

            Hexley.firewallLoaded = true;
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} Initialized!`);
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', Hexley.frameworks.aurora.tintYellow)} Database is not loaded. Firewall will be unavailable.`);
        }
    },

    /**
     * Seeds the database with default firewall settings if they are not already present.
     * @param {any} Hexley - The main Hexley global object.
     */
    async _seedDefaultSettings(Hexley: any) {
        const settings = [
            { setting: 'isActive', value: 'true' },
            { setting: 'blacklistTolerance', value: '10' }, // requests
            { setting: 'blacklistTimeout', value: '5' }, // in minutes
            { setting: 'totalRequestsFulfilled', value: '0' }
        ];

        for (const s of settings) {
            const existing = await Hexley.frameworks.database.get({ options: { tableName: 'firewallConfigTable' } }, { setting: s.setting });
            if (!existing) {
                await Hexley.frameworks.database.upsert({ options: { tableName: 'firewallConfigTable' } }, s);
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} Seeded default setting: ${s.setting} = ${s.value}`);
            }
        }
    },

    /**
     * Increments the total number of fulfilled requests in the database.
     * @param {any} Hexley - The main Hexley global object.
     */
    async incrementTotalRequests(Hexley: any) {
        if (!Hexley.databaseLoaded) return;

        const counter = await Hexley.frameworks.database.get({ options: { tableName: 'firewallConfigTable' } }, { setting: 'totalRequestsFulfilled' });
        
        const currentValue = (counter && counter.value) ? parseInt(counter.value, 10) : 0;
        
        await Hexley.frameworks.database.upsert({ options: { tableName: 'firewallConfigTable' } }, {
            setting: 'totalRequestsFulfilled',
            value: (currentValue + 1).toString()
        });
    },

    /**
     * Inspects an incoming IP address and determines if the request should be allowed.
     * @param {any} Hexley - The main Hexley global object.
     * @param {string} ipAddress - The IP address making the request.
     * @param {string} pathRequested - The URL path the IP is requesting.
     * @returns {Promise<boolean>} A promise that resolves to true if the request is allowed, false otherwise.
     */
    async inspectAddress(Hexley: any, ipAddress: string, pathRequested: string): Promise<boolean> {
        if (!Hexley.databaseLoaded) return true;

        const settingsArray = await Hexley.frameworks.database.getAll('firewallConfigTable');
        const settings = settingsArray.reduce((acc: any, curr: any) => {
            acc[curr.setting] = curr.value;
            return acc;
        }, {});

        if (settings.isActive !== 'true') {
            return true;
        }

        const ipInfoResult = await Hexley.frameworks.database.get({ options: { tableName: 'firewallMetIPsTable' } }, { ipAddress });
        const now = new Date();

        if (ipInfoResult) {
            // Convert the Sequelize instance to a plain object to ensure modifications are safe.
            const ipInfo = ipInfoResult.get ? ipInfoResult.get({ plain: true }) : ipInfoResult;

            if (ipInfo.isBlacklisted) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} Denied connection from already blacklisted IP: ${ipAddress}`);
                return false;
            }
            if (ipInfo.isWhitelisted) return true;

            const timeoutMinutes = parseInt(settings.blacklistTimeout, 10);
            const tolerance = parseInt(settings.blacklistTolerance, 10);
            
            const firstSeenTime = new Date(ipInfo.firstSeen);
            const minutesSinceFirstContact = (now.getTime() - firstSeenTime.getTime()) / (1000 * 60);

            if (minutesSinceFirstContact > timeoutMinutes) {
                ipInfo.contactCount = 1;
                ipInfo.firstSeen = now;
            } else {
                ipInfo.contactCount++;
            }

            ipInfo.lastSeen = now;
            ipInfo.lastPathRequested = pathRequested;
            
            if (ipInfo.contactCount >= tolerance && (now.getTime() - new Date(ipInfo.firstSeen).getTime()) / (1000 * 60) <= timeoutMinutes) {
                ipInfo.isBlacklisted = true;
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} Blacklisting IP: ${ipAddress} (Exceeded tolerance of ${tolerance} requests in ${timeoutMinutes} minutes)`);
            }
            
            await Hexley.frameworks.database.upsert({ options: { tableName: 'firewallMetIPsTable' } }, ipInfo);
            return !ipInfo.isBlacklisted;

        } else {
            const newIpEntry = {
                ipAddress,
                contactCount: 1,
                firstSeen: now,
                lastSeen: now,
                lastPathRequested: pathRequested
            };
            await Hexley.frameworks.database.add({ options: { tableName: 'firewallMetIPsTable' } }, newIpEntry, {});
            return true;
        }
    },

};

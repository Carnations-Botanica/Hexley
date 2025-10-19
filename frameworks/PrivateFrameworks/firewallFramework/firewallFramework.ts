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
        
        if (Hexley.resources.framework.database.isLoaded) {
            await Hexley.frameworks.database.initTable(firewallConfigTable);
            await Hexley.frameworks.database.initTable(firewallMetIPsTable);
            await this._seedDefaultSettings(Hexley);
            Hexley.resources.framework.firewall.isLoaded = true;
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} Initialized! Resources updated with ${Hexley.resources.framework.firewall.isLoaded} for isLoaded.`);
        } else {
            Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} Database is not loaded. Firewall will be unavailable.`);
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
            } else {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} Setting ${s.setting} with value ${s.value} already exists.`)
            }
        }
    },

    /**
     * Increments the total number of fulfilled requests in the database.
     * @param {any} Hexley - The main Hexley global object.
     */
    async incrementTotalRequests(Hexley: any) {
        if (!Hexley.resources.framework.database.isLoaded) return;

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
        if (!Hexley.resources.framework.database.isLoaded) return true;

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

        // Malicious Path Check - Trying to view any of these will automatically blacklist you.
        const MALICIOUS_PATTERNS = [
            '.php', 
            '/admin/', 
            '/owa/', 
            '/.git/',
            'config.js',
            'config.php',
            'login',
            '/tr/',
            'chs/js/'
        ];
        
        const isMaliciousPath = MALICIOUS_PATTERNS.some(pattern => pathRequested.includes(pattern));

        if (isMaliciousPath) {
            const ipInfo = ipInfoResult?.get ? ipInfoResult.get({ plain: true }) : (ipInfoResult || { ipAddress, contactCount: 1, firstSeen: now });
            
            ipInfo.isBlacklisted = true;
            ipInfo.lastSeen = now;
            ipInfo.lastPathRequested = pathRequested;
            ipInfo.contactCount = ipInfo.contactCount || 1; 

            Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} INSTANT DENIAL: Blacklisting IP ${ipAddress} (Path: ${pathRequested})`);
            
            await Hexley.frameworks.database.upsert({ options: { tableName: 'firewallMetIPsTable' } }, ipInfo);
            return false;
        }

        if (ipInfoResult) {
            // Convert the Sequelize instance to a plain object to ensure modifications are safe.
            const ipInfo = ipInfoResult.get ? ipInfoResult.get({ plain: true }) : ipInfoResult;

            if (ipInfo.isBlacklisted) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} Denied connection from already blacklisted IP: ${ipAddress}`);
                return false;
            }
            if (ipInfo.isWhitelisted) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} ALLOWED: Whitelisted IP ${ipAddress}`);
                return true;
            }

            const timeoutMinutes = parseInt(settings.blacklistTimeout, 10);
            const tolerance = parseInt(settings.blacklistTolerance, 10);
            
            const firstSeenTime = new Date(ipInfo.firstSeen);
            const minutesSinceFirstContact = (now.getTime() - firstSeenTime.getTime()) / (1000 * 60);
            const previousContactCount = ipInfo.contactCount;

            if (minutesSinceFirstContact > timeoutMinutes) {
                ipInfo.contactCount = 1;
                ipInfo.firstSeen = now;
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} RESET: IP ${ipAddress} contact count reset after timeout. New count: 1 (Path: ${pathRequested})`);
            } else {
                ipInfo.contactCount++;
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} UPDATED: IP ${ipAddress} contact count increased to ${ipInfo.contactCount} (Path: ${pathRequested})`);
            }

            ipInfo.lastSeen = now;
            ipInfo.lastPathRequested = pathRequested;
            
            if (ipInfo.contactCount >= tolerance && (now.getTime() - new Date(ipInfo.firstSeen).getTime()) / (1000 * 60) <= timeoutMinutes) {
                ipInfo.isBlacklisted = true;
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} BLACKLISTED: IP ${ipAddress} (Exceeded ${tolerance} requests in ${timeoutMinutes} minutes)`);
            }
            
            const result = !ipInfo.isBlacklisted;
            if (result && ipInfo.contactCount < tolerance) {
                Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} ALLOWED: IP ${ipAddress} (Count: ${ipInfo.contactCount}/${tolerance})`);
            }
            
            await Hexley.frameworks.database.upsert({ options: { tableName: 'firewallMetIPsTable' } }, ipInfo);
            return result;

        } else {
            const newIpEntry = {
                ipAddress,
                contactCount: 1,
                firstSeen: now,
                lastSeen: now,
                lastPathRequested: pathRequested
            };

            Hexley.log(`${Hexley.frameworks.aurora.colorText('[firewallFramework]', this.frameworkColor)} NEW IP MET: IP ${ipAddress} recorded and allowed (Path: ${pathRequested})`);
            await Hexley.frameworks.database.upsert({ options: { tableName: 'firewallMetIPsTable' } }, newIpEntry);
            return true;
        }
    },

};
